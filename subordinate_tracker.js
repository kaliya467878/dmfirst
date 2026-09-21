/**
 * WINGO PROMOTER SUBORDINATE SYNC (STANDALONE REFERENCE)
 * Run this script in the Chrome console of your bg678r.com Subordinate List / Promotion Member page.
 * It will send the list of direct registrations and recharge values to the local predictor server.
 */
(function() {
  const SERVER_URL = "http://localhost:3000"; // Adjust this URL to your deployed app server
  console.log("%c[Sub Sync]%c Initialized. Monitoring direct subordinates...", "color:#4f46e5; font-weight:bold;", "color:#00e676;");

  async function syncSubordinates() {
    try {
      // Find standard table structures
      const table = document.querySelector('table, .uni-table, .member-table, .table');
      if (!table) {
        console.warn("[Sub Sync] Subordinates table not found. Make sure you are on the Subordinates list page.");
        return;
      }
      
      // Parse table headers
      const headers = Array.from(table.querySelectorAll('th, .uni-table-th')).map(el => el.innerText.trim().toLowerCase());
      
      // Dynamically locate Member UID and Recharge/Deposit columns
      let uidIndex = headers.findIndex(h => h.includes('id') || h.includes('uid') || h.includes('user') || h.includes('member'));
      let depositIndex = headers.findIndex(h => h.includes('deposit') || h.includes('recharge') || h.includes('pay') || h.includes('amount') || h.includes('recharge amount'));
      
      // Fallbacks
      if (uidIndex === -1) uidIndex = 0; 
      if (depositIndex === -1) depositIndex = headers.length > 2 ? 2 : 1; 

      const subordinates = [];
      const rows = table.querySelectorAll('tbody tr, .uni-table-tr');
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, .uni-table-td')).map(el => el.innerText.trim());
        if (cells.length > Math.max(uidIndex, depositIndex)) {
          const uid = cells[uidIndex];
          const depositStr = cells[depositIndex].replace(/[^0-9.]/g, ''); 
          const deposit = parseFloat(depositStr) || 0;
          
          if (uid && /^\d+$/.test(uid)) {
            subordinates.push({ uid, deposit });
          }
        }
      });

      if (subordinates.length > 0) {
        console.log(`[Sub Sync] Found ${subordinates.length} members. Syncing with server...`);
        const res = await fetch(`${SERVER_URL}/api/tracker/subordinates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subordinates })
        });
        const data = await res.json();
        console.log(`%c[Sub Sync] Sync complete! Approved ${data.approved} new depositors.`, "color:#00e676; font-weight:bold;");
      }
    } catch (err) {
      console.error("[Sub Sync Error]", err);
    }
  }

  // Poll subordinates list page every 5 seconds
  setInterval(syncSubordinates, 5000);
  syncSubordinates();
})();
