"""Budget kill switch for the Wow Miam Firebase project.

Cloud Billing posts budget notifications to a Pub/Sub topic several times a day. When the month's
spend reaches KILL_AT (in the billing account's currency), this function detaches billing from the
project: paid services stop at once, so the bill can't grow past roughly that amount. Billing data
lags by a few hours, which is why the default threshold (0.50) sits below the 1.00 budget.

Re-enable billing by hand (Firebase console > Usage and billing) once you've checked what happened.
"""
from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass

import functions_framework
from cloudevents.http import CloudEvent
from google.cloud import billing_v1

PROJECT_ID: str = os.environ.get("PROJECT_ID", "wowmiam-2fa59")
KILL_AT: float = float(os.environ.get("KILL_AT", "0.5"))


@dataclass(frozen=True)
class BudgetNotice:
    cost: float
    budget: float
    currency: str


def parse_notice(event: CloudEvent) -> BudgetNotice:
    """Budget notifications carry a base64 JSON payload in the Pub/Sub message."""
    payload = json.loads(base64.b64decode(event.data["message"]["data"]))
    return BudgetNotice(
        cost=float(payload["costAmount"]),
        budget=float(payload["budgetAmount"]),
        currency=str(payload.get("currencyCode", "")),
    )


def should_stop(notice: BudgetNotice, kill_at: float = KILL_AT) -> bool:
    return notice.cost >= kill_at


def billing_enabled(client: billing_v1.CloudBillingClient, project: str) -> bool:
    return client.get_project_billing_info(name=f"projects/{project}").billing_enabled


def detach_billing(client: billing_v1.CloudBillingClient, project: str) -> None:
    client.update_project_billing_info(
        name=f"projects/{project}",
        project_billing_info=billing_v1.ProjectBillingInfo(billing_account_name=""),
    )


@functions_framework.cloud_event
def stop_billing(event: CloudEvent) -> None:
    notice = parse_notice(event)
    if not should_stop(notice):
        print(f"Spend {notice.cost:.2f} {notice.currency} is under {KILL_AT:.2f}: nothing to do.")
        return
    client = billing_v1.CloudBillingClient()
    if not billing_enabled(client, PROJECT_ID):
        print("Billing is already detached.")
        return
    detach_billing(client, PROJECT_ID)
    print(f"Spend {notice.cost:.2f} {notice.currency} reached {KILL_AT:.2f}: billing detached from {PROJECT_ID}.")
