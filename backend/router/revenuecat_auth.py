"""RevenueCat premium verification for API protection."""

import httpx
from fastapi import Header, HTTPException, status
from typing import Optional
import logging
import config

logger = logging.getLogger(__name__)


class RevenueCatVerifier:
    """Handles verification of premium subscriptions via RevenueCat API"""

    def __init__(self):
        self.api_key = config.REVENUECAT_API_KEY
        self.api_url = config.REVENUECAT_API_URL
        self.premium_entitlement = config.PREMIUM_ENTITLEMENT_ID

        if not self.api_key:
            logger.warning("⚠️  REVENUECAT_API_KEY not set - premium verification disabled")

    async def verify_premium(self, user_id: str) -> bool:
        """
        Verify if a user has an active premium subscription.

        Args:
            user_id: RevenueCat App User ID

        Returns:
            bool: True if user has active premium subscription
        """
        if not self.api_key:
            # If no API key configured, allow all requests (development mode)
            logger.warning(f"⚠️  Premium check skipped for {user_id} - no API key")
            return True

        try:
            url = f"{self.api_url}/subscribers/{user_id}"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "X-Platform": "ios",  # or get from request
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)

                if response.status_code == 404:
                    # User not found in RevenueCat
                    logger.info(f"❌ User not found: {user_id}")
                    return False

                if response.status_code != 200:
                    logger.error(f"RevenueCat API error: {response.status_code}")
                    # Fail open on API errors (don't block users if RC is down)
                    return True

                data = response.json()
                subscriber = data.get("subscriber", {})
                entitlements = subscriber.get("entitlements", {})

                # Check if user has active premium entitlement
                has_premium = self.premium_entitlement in entitlements

                if has_premium:
                    logger.info(f"✅ Premium verified for: {user_id}")
                else:
                    logger.info(f"❌ No premium for: {user_id}")

                return has_premium

        except httpx.TimeoutException:
            logger.error("RevenueCat API timeout - failing open")
            return True  # Don't block users if RevenueCat is slow
        except Exception as e:
            logger.error(f"Error verifying premium: {str(e)}")
            return True  # Fail open on unexpected errors


# Create global verifier instance
revenuecat_verifier = RevenueCatVerifier()


async def require_premium(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> str:
    """
    FastAPI dependency that requires premium subscription.

    Usage:
        @app.post("/api/protected")
        async def protected_endpoint(user_id: str = Depends(require_premium)):
            # user_id is verified to have premium
            pass

    Args:
        x_user_id: RevenueCat user ID from X-User-ID header

    Returns:
        str: Verified user ID

    Raises:
        HTTPException: If user doesn't have premium or header missing
    """
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-User-ID header"
        )

    is_premium = await revenuecat_verifier.verify_premium(x_user_id)

    if not is_premium:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "premium_required",
                "message": "This feature requires an active premium subscription",
                "user_id": x_user_id
            }
        )

    return x_user_id


async def get_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> Optional[str]:
    """
    FastAPI dependency to get user ID without requiring premium.
    Useful for endpoints that have both free and premium features.

    Returns:
        Optional[str]: User ID or None if not provided
    """
    return x_user_id
