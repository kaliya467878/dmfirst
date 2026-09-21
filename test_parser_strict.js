function parseDepositText(text, targetDate) {
    console.log(`Analyzing OCR text for target date: ${targetDate}`);
    
    // 1. Basic validity check for deposit history page
    const isDeposit = /Deposit|Order|RC20|History|Recharge|UPI/i.test(text);
    if (!isDeposit) {
        return { 
            approved: false, 
            reason: '⚠️ Sahi Deposit History ka Screenshot upload karein (DMFirst -> Deposit History).' 
        };
    }

    // Prepare date regex (e.g. 2026-09-22 or 2026/09/22)
    const dateRegexStr = targetDate.replace(/-/g, '[-/\\.]');
    const todayRegex = new RegExp(dateRegexStr, 'g');

    // Split text into deposit cards based on "Deposit" header keyword
    const cardChunks = text.split(/(?=\bDeposit\b)/i).filter(c => c.trim().length > 10);
    console.log('Total Deposit Cards detected:', cardChunks.length);

    let approvedAmounts = [];

    cardChunks.forEach((card, idx) => {
        const hasToday = todayRegex.test(card);
        const isComplete = /Complete|Completed|Succeed|Success/i.test(card);
        const isRejectedStatus = /Failed|Pending|Unpaid|\bPaid\b|To be Paid|Processing/i.test(card);

        console.log(`Card ${idx+1}: Today=${hasToday}, Complete=${isComplete}, Rejected=${isRejectedStatus}, Content="${card.replace(/\s+/g, ' ').slice(0, 120)}..."`);

        // MUST have Today's date AND status MUST be Complete/Success AND MUST NOT be Failed/Paid/Pending
        if (hasToday && isComplete && !isRejectedStatus) {
            // Match amounts (e.g. 1,000.00, 500.00, 300)
            const matches = card.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
            if (matches) {
                matches.forEach(m => {
                    const clean = parseFloat(m.replace(/,/g, ''));
                    if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 100 && clean <= 500000) {
                        approvedAmounts.push(clean);
                    }
                });
            }
        }
    });

    console.log('Approved Amounts:', approvedAmounts);

    const validAmount = approvedAmounts.find(amt => amt >= 300);

    if (!validAmount) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date (${targetDate}) par Completed deposit ₹300 se kam hai (ya status Complete nahi hai). Minimum ₹300 Completed recharge required.` 
        };
    }

    return {
        approved: true,
        amount: validAmount,
        reason: `✅ Aaj ka Completed Deposit Verified: ₹${validAmount}!`
    };
}

// Test Case 1: "Paid" screenshot (MUST BE DECLINED)
const paidText = `
< Deposit history
Deposit
Order amount %1,000.00
Type UPI-QR
Time 2026-09-22 17:59:06
Status Paid
Order number RC20260922175906891103967a
`;

console.log('--- TEST 1: PAID SCREENSHOT ---');
console.log(parseDepositText(paidText, '2026-09-22'));

// Test Case 2: "Complete" screenshot (MUST BE APPROVED)
const completeText = `
< Deposit history
Deposit Complete
Order amount %1,000.00
Type UPI-QR-26010
Time 2026-09-22 18:00:25
Order number RC20260922180025211103022a
`;

console.log('\n--- TEST 2: COMPLETE SCREENSHOT ---');
console.log(parseDepositText(completeText, '2026-09-22'));
