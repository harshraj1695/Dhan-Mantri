/*
  # Add transaction update and delete policies

  1. Changes
    - Add update policy for transactions table
    - Add delete policy for transactions table

  2. Security
    - Users can only update their own transactions
    - Users can only delete their own transactions
*/

CREATE POLICY "Users can update own transactions"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);