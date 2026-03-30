from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class ExecutionResult:
    workflow_id: int
    triggered: bool
    message: str


class ExecutionEngine:
    """Simple workflow runner for trigger -> condition -> action."""

    def __init__(self, state_manager):
        self.state_manager = state_manager

    def run(self, workflow: dict[str, Any]) -> ExecutionResult:
        trigger = workflow.get("trigger", {})
        condition = workflow.get("condition", {})
        action = workflow.get("action", {})

        if not self._triggered(trigger):
            return ExecutionResult(workflow.get("id", -1), False, "Trigger not satisfied")

        if not self._condition_passed(condition):
            return ExecutionResult(workflow.get("id", -1), False, "Condition failed")

        self._execute_action(action)
        return ExecutionResult(workflow.get("id", -1), True, "Action executed")

    def _triggered(self, trigger: dict[str, Any]) -> bool:
        if not trigger:
            return True
        sensor = trigger.get("sensor")
        op = trigger.get("operator", ">")
        threshold = trigger.get("value", 0)
        current = self.state_manager.get_state(sensor)
        if current is None:
            return False
        if op == ">":
            return current > threshold
        if op == "<":
            return current < threshold
        if op == "==":
            return current == threshold
        return False

    def _condition_passed(self, condition: dict[str, Any]) -> bool:
        if not condition:
            return True
        field = condition.get("field")
        expected = condition.get("equals")
        current = self.state_manager.get_state(field)
        return current == expected

    def _execute_action(self, action: dict[str, Any]) -> None:
        target = action.get("device")
        value = action.get("value")
        if target:
            self.state_manager.set_state(target, value)
