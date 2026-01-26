#!/bin/bash
# Trigger YapMate Sales Automation Workflows
# Usage: ./trigger_sales_automation.sh [sequencer|email|both]

set -e

REPO="heycasi/yapmate"

trigger_sequencer() {
    echo "Triggering Lead Sequencer..."
    gh workflow run sequencer.yml --ref main -f skip_time_guard=true --repo "$REPO"
    echo "Lead Sequencer triggered!"
}

trigger_email() {
    echo "Triggering Email Sender..."
    gh workflow run email_sender.yml --ref main -f force_run=true -f dry_run=false --repo "$REPO"
    echo "Email Sender triggered!"
}

case "${1:-both}" in
    sequencer)
        trigger_sequencer
        ;;
    email)
        trigger_email
        ;;
    both)
        trigger_sequencer
        echo ""
        trigger_email
        ;;
    *)
        echo "Usage: $0 [sequencer|email|both]"
        exit 1
        ;;
esac

echo ""
echo "Check status: gh run list --repo $REPO"
