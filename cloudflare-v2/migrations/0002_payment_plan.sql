ALTER TABLE orders ADD COLUMN payment_plan TEXT NOT NULL DEFAULT 'once' CHECK(payment_plan IN ('once','monthly','quarterly'));
