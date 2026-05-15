SELECT column_name FROM information_schema.columns WHERE table_name = 'settings' AND column_name IN ('allowPartialPayment', 'allowNoPayment', 'allowFullPayment');
