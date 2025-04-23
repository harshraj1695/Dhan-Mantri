/*
  # Expense Split System Schema

  1. New Tables
    - `groups`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
    
    - `group_members`
      - `group_id` (uuid, references groups)
      - `user_id` (uuid, references auth.users)
      - `joined_at` (timestamptz)
    
    - `expenses`
      - `id` (uuid, primary key)
      - `group_id` (uuid, references groups)
      - `amount` (numeric)
      - `description` (text)
      - `paid_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
    
    - `expense_shares`
      - `expense_id` (uuid, references expenses)
      - `user_id` (uuid, references auth.users)
      - `amount` (numeric)
      - `status` (text) - 'pending' or 'settled'
      - `settled_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for group access
    - Add policies for expense management
*/

-- Groups table
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Group members table
CREATE TABLE group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Expenses table
CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  paid_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Expense shares table
CREATE TABLE expense_shares (
  expense_id uuid REFERENCES expenses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('pending', 'settled')) DEFAULT 'pending',
  settled_at timestamptz,
  PRIMARY KEY (expense_id, user_id)
);

ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Groups policies
CREATE POLICY "Users can view groups they are members of"
  ON groups
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = groups.id
      AND group_members.user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );

CREATE POLICY "Users can create groups"
  ON groups
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Group members policies
CREATE POLICY "Users can view group members"
  ON group_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group creators can add members"
  ON group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups
      WHERE groups.id = group_members.group_id
      AND groups.created_by = auth.uid()
    )
  );

-- Expenses policies
CREATE POLICY "Users can view expenses in their groups"
  ON expenses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add expenses to their groups"
  ON expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members
      WHERE group_members.group_id = expenses.group_id
      AND group_members.user_id = auth.uid()
    )
    AND paid_by = auth.uid()
  );

-- Expense shares policies
CREATE POLICY "Users can view expense shares in their groups"
  ON expense_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expenses e
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE e.id = expense_shares.expense_id
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create expense shares"
  ON expense_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses e
      WHERE e.id = expense_shares.expense_id
      AND e.paid_by = auth.uid()
    )
  );

CREATE POLICY "Users can update their own expense shares"
  ON expense_shares
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());