"""
Simple EventEmitter implementation for Python

This provides a basic event emitter pattern for the Agent/Orchestrator system.
"""

from typing import Any, Callable, Dict, List
import asyncio


class EventEmitter:
    """
    Simple event emitter for handling agent events
    """
    
    def __init__(self):
        self._listeners: Dict[str, List[Callable]] = {}
    
    def on(self, event: str, callback: Callable):
        """Register an event listener"""
        if event not in self._listeners:
            self._listeners[event] = []
        self._listeners[event].append(callback)
    
    def off(self, event: str, callback: Callable):
        """Remove an event listener"""
        if event in self._listeners:
            try:
                self._listeners[event].remove(callback)
            except ValueError:
                pass
    
    def remove_all_listeners(self, event: str):
        """Remove all listeners for a specific event"""
        if event in self._listeners:
            self._listeners[event].clear()
    
    def emit(self, event: str, *args, **kwargs):
        """Emit an event to all listeners"""
        if event in self._listeners:
            for callback in self._listeners[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        # For async callbacks, we'll need to handle them differently
                        # For now, just call them synchronously
                        callback(*args, **kwargs)
                    else:
                        callback(*args, **kwargs)
                except Exception as e:
                    print(f"Error in event listener for {event}: {e}")
    
    async def emit_async(self, event: str, *args, **kwargs):
        """Emit an event to all listeners (async version)"""
        if event in self._listeners:
            tasks = []
            for callback in self._listeners[event]:
                try:
                    if asyncio.iscoroutinefunction(callback):
                        tasks.append(callback(*args, **kwargs))
                    else:
                        # Run sync callbacks in thread pool
                        tasks.append(asyncio.get_event_loop().run_in_executor(
                            None, callback, *args, **kwargs
                        ))
                except Exception as e:
                    print(f"Error in event listener for {event}: {e}")
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
