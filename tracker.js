/**
 * WINGO LIVE RESULT SCRAPER (STANDALONE REFERENCE)
 * Run this inside your Chrome/Edge browser console on the bg678r.com Wingo page.
 * It will send results to the locally running node server.
 */
(function() {
  const SERVER_URL = "http://localhost:3000"; // Adjust this URL to your deployed app server
  console.log("%c[Wingo Scraper]%c Service Started. Monitoring history...", "color:#ff9100; font-weight:bold;", "color:#00e676;");
  
  let lastReportedPeriod = localStorage.getItem('last_reported_period') || "";

  // Mathematical color/size mapper from Wingo rules
  function parseNumberMeta(num) {
    const n = parseInt(num, 10);
    const size = n >= 5 ? 'Big' : 'Small';
    let color = 'Green';
    if (n === 0) color = 'Red+Violet';
    else if (n === 5) color = 'Green+Violet';
    else if (n % 2 === 0) color = 'Red';
    return { size, color };
  }

  async function checkHistoryTable() {
    try {
      // Find rows in history table. These sites usually render them in standard tabular nodes
      const rows = document.querySelectorAll('tr, .game-record-item, .uni-table-tr');
      
      for (const row of rows) {
        const text = row.innerText || row.textContent || "";
        const periodMatch = text.match(/\b20\d{10,14}\b/);
        
        if (periodMatch) {
          const period = periodMatch[0];
          
          // If we already sent this, we are done (first row is latest)
          if (period === lastReportedPeriod) {
            break;
          }
          
          // Find winning digit cell in the row
          const cells = Array.from(row.querySelectorAll('td, span, div'))
            .map(el => el.innerText ? el.innerText.trim() : "")
            .filter(txt => txt.length === 1 && /^[0-9]$/.test(txt));
          
          if (cells.length > 0) {
            const num = parseInt(cells[0], 10);
            const { size, color } = parseNumberMeta(num);
            
            console.log(`%c[Scraper] New Result Detected! Period: ${period}, Number: ${num} (${color}, ${size})`, "color:#4f46e5; font-weight:bold;");
            
            // Post result to our server
            await fetch(`${SERVER_URL}/api/tracker/update`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
              },
              body: JSON.stringify({ period, number: num, color, size })
            });

            lastReportedPeriod = period;
            localStorage.setItem('last_reported_period', period);
            break; // only process the latest row
          }
        }
      }
    } catch (err) {
      console.error("[Scraper Error]", err);
    }
  }

  // Poll DOM for changes every 2 seconds
  setInterval(checkHistoryTable, 2000);
})();
