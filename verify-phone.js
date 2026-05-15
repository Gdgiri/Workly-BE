function sanitizePhoneNumber(phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    // If it's a 10-digit number, prepend 91 (India)
    if (digits.length === 10) {
        return `91${digits}`;
    }
    return digits;
}

const testCases = [
    { input: '8760561318', expected: '918760561318' },
    { input: '+918760561318', expected: '918760561318' },
    { input: '918760561318', expected: '918760561318' },
    { input: '08760561318', expected: '08760561318' }, // 11 digits
    { input: '', expected: '' }
];

testCases.forEach(({ input, expected }) => {
    const result = sanitizePhoneNumber(input);
    console.log(`Input: "${input}", Expected: "${expected}", Result: "${result}" - ${result === expected ? '✅' : '❌'}`);
});
