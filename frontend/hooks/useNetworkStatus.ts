import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  details: NetInfoState;
}

export interface UseNetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  checkInterval?: number;
}

export function useNetworkStatus(options: UseNetworkStatusOptions = {}) {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    details: {} as NetInfoState,
  });

  const previousStatusRef = useRef<boolean>(true);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const handleNetworkChange = (state: NetInfoState) => {
      const isConnected = state.isConnected ?? false;
      const isInternetReachable = state.isInternetReachable;

      setNetworkStatus({
        isConnected,
        isInternetReachable,
        type: state.type,
        details: state,
      });

      if (isConnected && !previousStatusRef.current) {
        // Network connection restored
        optionsRef.current.onOnline?.();
      } else if (!isConnected && previousStatusRef.current) {
        // Network connection lost
        optionsRef.current.onOffline?.();
      }

      previousStatusRef.current = isConnected;
    };

    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);
    NetInfo.fetch().then(handleNetworkChange);

    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    const state = await NetInfo.fetch();
    setNetworkStatus({
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      details: state,
    });
    return state;
  }, []);

  return {
    ...networkStatus,
    refresh,
  };
}
