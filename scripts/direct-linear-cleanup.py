#!/usr/bin/env python3
"""
Direct Linear API cleanup script
Bypasses queue system for immediate results
"""

import os
import requests
import json
import time

LINEAR_API_KEY = "REDACTED_LINEAR_API_KEY"
LINEAR_API_URL = "https://api.linear.app/graphql"

headers = {
    "Authorization": LINEAR_API_KEY,
    "Content-Type": "application/json"
}

# Define ticket lists
WORKER_TRACE_TICKETS = [
    "1M-610", "1M-611", "1M-612", "1M-613", "1M-614",
    "1M-615", "1M-616", "1M-617", "1M-618", "1M-619",
    "1M-620", "1M-488", "1M-466", "1M-467"
]

TRACK_TICKETS = [
    "1M-573", "1M-574", "1M-575", "1M-576", "1M-577", "1M-578"
]

def get_canceled_state_id():
    """Get the ID of the 'Canceled' workflow state"""
    query = """
    query {
      workflowStates(filter: { name: { eq: "Canceled" } }) {
        nodes {
          id
          name
          team {
            key
          }
        }
      }
    }
    """
    response = requests.post(LINEAR_API_URL, json={"query": query}, headers=headers)
    data = response.json()

    # Find the Canceled state for team 1M
    for state in data["data"]["workflowStates"]["nodes"]:
        if state["team"]["key"] == "1M":
            print(f"✅ Found Canceled state ID: {state['id']}")
            return state["id"]

    raise Exception("Could not find Canceled state for team 1M")

def get_issue_id(ticket_identifier):
    """Get Linear issue ID from identifier like '1M-610'"""
    query = """
    query($identifier: String!) {
      issue(id: $identifier) {
        id
        identifier
        title
        state {
          name
        }
      }
    }
    """
    response = requests.post(
        LINEAR_API_URL,
        json={"query": query, "variables": {"identifier": ticket_identifier}},
        headers=headers
    )
    data = response.json()

    if "errors" in data:
        print(f"❌ Error getting {ticket_identifier}: {data['errors']}")
        return None

    issue = data["data"]["issue"]
    print(f"📋 {ticket_identifier}: {issue['title']} (Current state: {issue['state']['name']})")
    return issue["id"]

def update_issue_state(issue_id, state_id, comment_text):
    """Update issue to new state and add comment"""
    # First update the state
    mutation = """
    mutation($issueId: String!, $stateId: String!) {
      issueUpdate(id: $issueId, input: { stateId: $stateId }) {
        success
        issue {
          identifier
          state {
            name
          }
        }
      }
    }
    """

    response = requests.post(
        LINEAR_API_URL,
        json={"query": mutation, "variables": {"issueId": issue_id, "stateId": state_id}},
        headers=headers
    )
    data = response.json()

    if "errors" in data:
        print(f"❌ Error updating state: {data['errors']}")
        return False

    if data["data"]["issueUpdate"]["success"]:
        identifier = data["data"]["issueUpdate"]["issue"]["identifier"]
        state_name = data["data"]["issueUpdate"]["issue"]["state"]["name"]
        print(f"✅ Updated {identifier} to {state_name}")

        # Add comment
        comment_mutation = """
        mutation($issueId: String!, $body: String!) {
          commentCreate(input: { issueId: $issueId, body: $body }) {
            success
          }
        }
        """

        comment_response = requests.post(
            LINEAR_API_URL,
            json={"query": comment_mutation, "variables": {"issueId": issue_id, "body": comment_text}},
            headers=headers
        )
        comment_data = comment_response.json()

        if comment_data["data"]["commentCreate"]["success"]:
            print(f"  💬 Added comment")

        return True

    return False

def main():
    print("=" * 60)
    print("Linear Direct Cleanup Script")
    print("=" * 60)

    # Get Canceled state ID
    canceled_state_id = get_canceled_state_id()

    success_count = 0
    failed_count = 0
    failed_tickets = []

    # Phase 1: WORKER TRACE TEST tickets
    print("\n" + "=" * 60)
    print("Phase 1: Archiving WORKER TRACE TEST tickets (14 tickets)")
    print("=" * 60)

    for ticket in WORKER_TRACE_TICKETS:
        print(f"\nProcessing {ticket}...")
        issue_id = get_issue_id(ticket)

        if issue_id:
            if update_issue_state(issue_id, canceled_state_id, "Archived as test pollution - cleanup operation 2025-12-04"):
                success_count += 1
            else:
                failed_count += 1
                failed_tickets.append(ticket)
        else:
            failed_count += 1
            failed_tickets.append(ticket)

        time.sleep(0.5)  # Rate limit protection

    # Phase 2: Track: tickets
    print("\n" + "=" * 60)
    print("Phase 2: Closing duplicate Track: tickets (6 tickets)")
    print("=" * 60)

    for ticket in TRACK_TICKETS:
        print(f"\nProcessing {ticket}...")
        issue_id = get_issue_id(ticket)

        if issue_id:
            if update_issue_state(issue_id, canceled_state_id, "Closed as duplicate tracking ticket - cleanup operation 2025-12-04"):
                success_count += 1
            else:
                failed_count += 1
                failed_tickets.append(ticket)
        else:
            failed_count += 1
            failed_tickets.append(ticket)

        time.sleep(0.5)  # Rate limit protection

    # Summary
    print("\n" + "=" * 60)
    print("Cleanup Summary")
    print("=" * 60)
    print(f"✅ Successfully processed: {success_count} tickets")
    print(f"❌ Failed: {failed_count} tickets")

    if failed_tickets:
        print("\nFailed tickets:")
        for ticket in failed_tickets:
            print(f"  - {ticket}")

    print("\n✅ Cleanup operation complete!")

if __name__ == "__main__":
    main()
