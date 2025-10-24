"""
RevenueCat authentication and premium verification for GeistAI
"""
import httpx
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, Header
import os

logger = logging.getLogger(__name__)

class RevenueCatAuth:
    def __init__(self):
        self.api_key = os.getenv("REVENUECAT_API_KEY")
        self.base_url = "https://api.revenuecat.com/v1"

        if not self.api_key:
            logger.warning("REVENUECAT_API_KEY not found in environment variables")

    async def verify_user_premium(self, user_id: str) -> Dict[str, Any]:
        """
        Verify if a user has an active premium subscription
        """
        if not self.api_key:
            logger.warning("RevenueCat API key not configured, defaulting to non-premium for testing")
            return {
                "is_premium": False,
                "subscription_status": "inactive",
                "product_id": None,
                "expires_at": None,
                "source": "no_verification"
            }

        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }

                # Get subscriber info
                response = await client.get(
                    f"{self.base_url}/subscribers/{user_id}",
                    headers=headers
                )

                if response.status_code == 404:
                    logger.info(f"User {user_id} not found in RevenueCat")
                    return {
                        "is_premium": False,
                        "subscription_status": "not_found",
                        "product_id": None,
                        "expires_at": None,
                        "source": "revenuecat"
                    }

                if response.status_code != 200:
                    logger.error(f"RevenueCat API error: {response.status_code} - {response.text}")
                    raise HTTPException(
                        status_code=500,
                        detail="Premium verification service unavailable"
                    )

                data = response.json()
                subscriber = data.get("subscriber", {})
                entitlements = subscriber.get("entitlements", {})

                # Check for premium entitlement
                premium_entitlement = entitlements.get("premium", {})
                is_premium = premium_entitlement.get("expires_date") is None or \
                           premium_entitlement.get("expires_date") > subscriber.get("first_seen", "")

                return {
                    "is_premium": is_premium,
                    "subscription_status": "active" if is_premium else "expired",
                    "product_id": premium_entitlement.get("product_identifier"),
                    "expires_at": premium_entitlement.get("expires_date"),
                    "source": "revenuecat"
                }

        except httpx.RequestError as e:
            logger.error(f"RevenueCat request error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Premium verification service unavailable"
            )
        except Exception as e:
            logger.error(f"RevenueCat verification error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Premium verification failed"
            )

# Global instance
revenuecat_auth = RevenueCatAuth()

async def require_premium(user_id: str = Header(None, alias="X-User-ID")) -> Dict[str, Any]:
    """
    FastAPI dependency to require premium subscription
    """
    # Check for bypass flag for testing
    if os.getenv("DISABLE_PREMIUM_CHECK", "false").lower() == "true":
        logger.info(f"[TESTING] Premium check disabled for user: {user_id}")
        return {
            "is_premium": True,
            "subscription_status": "active",
            "product_id": "test_premium",
            "expires_at": None,
            "source": "testing_bypass"
        }

    # TEMPORARY: Always return premium for testing
    logger.info(f"[TESTING] TEMPORARY: Always returning premium for user: {user_id}")
    return {
        "is_premium": True,
        "subscription_status": "active",
        "product_id": "test_premium",
        "expires_at": None,
        "source": "temporary_testing"
    }

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID required for premium verification"
        )

    premium_status = await revenuecat_auth.verify_user_premium(user_id)

    if not premium_status["is_premium"]:
        raise HTTPException(
            status_code=403,
            detail="Premium subscription required"
        )

    return premium_status

def get_user_id(user_id: str = Header(None, alias="X-User-ID")) -> str:
    """
    FastAPI dependency to get user ID
    """
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID required"
        )
    return user_id
