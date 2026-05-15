DELETE c1 FROM customers c1
INNER JOIN customers c2 
WHERE c1.id > c2.id AND c1.email = c2.email;
