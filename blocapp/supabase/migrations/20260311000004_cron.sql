-- Penalty accrual cron job — requires pg_cron extension (enable in Supabase Dashboard first!)
SELECT cron.schedule(
  'accrue-penalties',
  '0 6 * * *',
  $$
  UPDATE apartment_charges ac
  SET
    penalties = penalties + ROUND(((total_due - amount_paid) * (
      SELECT penalty_rate_per_day FROM monthly_reports WHERE id = ac.report_id
    ))::numeric, 2),
    total_due = total_due + ROUND(((total_due - amount_paid) * (
      SELECT penalty_rate_per_day FROM monthly_reports WHERE id = ac.report_id
    ))::numeric, 2),
    last_penalty_date = CURRENT_DATE
  WHERE
    payment_status != 'paid'
    AND penalties_waived = false
    AND (last_penalty_date IS NULL OR last_penalty_date < CURRENT_DATE)
    AND EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = ac.report_id
        AND mr.status = 'published'
        AND mr.due_date IS NOT NULL
        AND mr.due_date < CURRENT_DATE
    );
  $$
);
