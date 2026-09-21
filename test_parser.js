function parseDepositText(text, targetDate) {
    console.log(`Analyzing OCR text for target date: ${targetDate}`);
    
    // Basic validity check
    const isDeposit = /Deposit|Order|RC20/i.test(text);
    if (!isDeposit) {
        return { approved: false, reason: '⚠️ Sahi Deposit History ka Screenshot upload karein.' };
    }

    // Check if target date (e.g. 2026-09-20) exists in the text
    const todayRegex = new RegExp(targetDate.replace(/-/g, '[-/\\.]'), 'g');
    const hasTodayDate = todayRegex.test(text);

    if (!hasTodayDate) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date (${targetDate}) ka deposit nahi mila. Kripya aaj ka Deposit History screenshot upload karein.` 
        };
    }

    // Parse amounts: Find all occurrences of amounts in lines containing "Order amount" or currency symbols
    const lines = text.split('\n');
    let amounts = [];

    lines.forEach(line => {
        // Look for numbers like 1,000.00, 500.00, 300, 1000 in lines with Order amount or numbers
        if (/Order\s*amount|amount|Complete/i.test(line) || /[₹%]\s*\d/.test(line)) {
            const matches = line.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
            if (matches) {
                matches.forEach(m => {
                    const clean = parseFloat(m.replace(/,/g, ''));
                    if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 100) {
                        amounts.push(clean);
                    }
                });
            }
        }
    });

    // Fallback: search whole text for numbers >= 300 that are not years
    if (amounts.length === 0) {
        const allMatches = text.match(/([1-9]\d{0,2}(?:,\d{3})+|[1-9]\d{2,5})(?:\.\d{2})?/g);
        if (allMatches) {
            allMatches.forEach(m => {
                const clean = parseFloat(m.replace(/,/g, ''));
                if (!isNaN(clean) && clean !== 2026 && clean !== 2025 && clean >= 300 && clean <= 500000) {
                    amounts.push(clean);
                }
            });
        }
    }

    console.log('Parsed Amounts:', amounts);

    const validAmount = amounts.find(amt => amt >= 300);

    if (!validAmount) {
        return { 
            approved: false, 
            reason: `⚠️ Aaj ki date ka deposit ₹300 se kam hai. Access ke liye minimum ₹300 recharge zaruri hai.` 
        };
    }

    return {
        approved: true,
        amount: validAmount,
        reason: `✅ Aaj ka Deposit Verified: ₹${validAmount}!`
    };
}

// Test with sample text from OCR
const sampleText = `
icon -c (EERE om
< Deposit history
Len Lew .
25%
ArUpi Pay UPI X GR EW
AU Vv Choose a date v
Order amount %1,000.00
Type UPI-GR-26010
Time 2026-09-20 18:00:25
Order number RC20260920180025211103022a
`;

console.log(parseDepositText(sampleText, '2026-09-20'));
