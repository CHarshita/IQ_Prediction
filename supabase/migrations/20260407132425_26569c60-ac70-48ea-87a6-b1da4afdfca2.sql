
DROP POLICY "Service can insert predictions" ON predictions;
CREATE POLICY "Authenticated can insert predictions" ON predictions FOR INSERT TO authenticated WITH CHECK (true);
