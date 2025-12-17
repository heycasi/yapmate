interface StatusPillProps {
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue'
  className?: string
}

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const statusClasses = {
    draft: 'status-draft',
    sent: 'status-sent',
    paid: 'status-paid',
    cancelled: 'status-overdue',
    overdue: 'status-overdue',
  }

  const statusLabels = {
    draft: 'Draft',
    sent: 'Sent',
    paid: 'Paid',
    cancelled: 'Cancelled',
    overdue: 'Overdue',
  }

  return (
    <span className={`${statusClasses[status]} ${className}`}>
      {statusLabels[status]}
    </span>
  )
}
