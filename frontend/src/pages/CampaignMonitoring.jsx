import React, { useEffect, useState, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { FiMail, FiCheckCircle, FiXCircle, FiPercent, FiDownload, FiSearch } from 'react-icons/fi';

ChartJS.register(ArcElement, Tooltip, Legend);

// --- Reusable Stat Card Component (no changes) ---
const StatCard = ({ icon, title, value, color }) => (
    <div style={{
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flex: '1 1 200px',
    }}>
        <div style={{ backgroundColor: `${color}1A`, color, borderRadius: '50%', padding: '12px', display: 'grid', placeItems: 'center' }}>
            {icon}
        </div>
        <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#64748b' }}>{title}</h3>
            <p style={{ margin: '4px 0 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{value}</p>
        </div>
    </div>
);

// --- NEW: Custom hook for sorting the table ---
const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};


// --- Main Dashboard Component ---
export default function CampaignMonitoring() {
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [messageLog, setMessageLog] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // --- State for advanced filtering ---
  const [analysisMode, setAnalysisMode] = useState('single'); // 'single' or 'dateRange'
  const [singleCampaignId, setSingleCampaignId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7))); // Default to last 7 days
  const [endDate, setEndDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(new Set());
  
  // --- NEW: State for table filtering ---
  const [statusFilter, setStatusFilter] = useState('All');
  const [tableSearch, setTableSearch] = useState('');

  // 1. Fetch all campaigns once on mount
  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/campaigns');
        const data = await res.json();
        setAllCampaigns(data);
        if (data.length > 0) {
          setSingleCampaignId(data[0].campaignId);
        }
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      }
    };
    fetchCampaigns();
  }, []);

  // 2. Fetch logs for SINGLE campaign view (polling)
  useEffect(() => {
    if (analysisMode !== 'single' || !singleCampaignId) {
        setMessageLog([]);
        return;
    };

    setLoading(true);
    const fetchSingleLog = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/message-log?campaignId=${singleCampaignId}`);
        const data = await res.json();
        setMessageLog(data);
      } catch (err) { console.error("Failed to fetch single log:", err); }
      finally { setLoading(false); }
    };

    fetchSingleLog();
    const intervalId = setInterval(fetchSingleLog, 5000);
    return () => clearInterval(intervalId);
  }, [analysisMode, singleCampaignId]);


  // 3. Memoized calculation for filtering campaigns in Date Range mode
  const filteredCampaigns = useMemo(() => {
    return allCampaigns
      .filter(c => {
        const campaignDate = new Date(c.uploadedAt);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Set to start of the day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set to end of the day
        return campaignDate >= start && campaignDate <= end;
      })
      .filter(c => c.originalFilename.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allCampaigns, startDate, endDate, searchTerm]);

  // 4. Handler for fetching aggregated data
  const handleAnalyzeDateRange = async () => {
    if (selectedCampaignIds.size === 0) {
        alert("Please select at least one campaign to analyze.");
        return;
    }
    setLoading(true);
    try {
        const res = await fetch('http://localhost:3000/api/message-logs/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaignIds: Array.from(selectedCampaignIds) })
        });
        const data = await res.json();
        setMessageLog(data);
    } catch (err) {
        console.error("Failed to fetch bulk logs:", err);
    } finally {
        setLoading(false);
    }
  };

  // 5. Handlers for multi-select checkboxes
  const toggleCampaignSelection = (id) => {
    const newSelection = new Set(selectedCampaignIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedCampaignIds(newSelection);
  };
   
  const selectAllFiltered = () => {
    setSelectedCampaignIds(new Set(filteredCampaigns.map(c => c.campaignId)));
  };

  // --- STATS & CHART DATA (no changes) ---
  const campaignStats = useMemo(() => {
    // ... same calculation logic as before
    const total = messageLog.length;
    if (total === 0) return { total: 0, sent: 0, failed: 0, pending: 0, successRate: '0.00' };
    
    const sent = messageLog.filter(log => log.status === 'Sent').length;
    const failed = messageLog.filter(log => log.status === 'Failed').length;
    const pending = total - sent - failed;
    const successRate = total > 0 ? ((sent / (sent + failed)) * 100).toFixed(2) : '0.00';

    return { total, sent, failed, pending, successRate: isNaN(successRate) ? '0.00' : successRate };
  }, [messageLog]);

  const pieChartData = {
    // ... same chart data as before
    labels: ['Sent', 'Failed', 'Pending'],
    datasets: [{
      data: [campaignStats.sent, campaignStats.failed, campaignStats.pending],
      backgroundColor: ['#22C55E', '#EF4444', '#64748B'],
      borderColor: ['#ffffff'],
      borderWidth: 2,
    }],
  };

  // --- NEW: Memoized hook to filter and sort the table data ---
  const { items: sortedMessageLog, requestSort, sortConfig } = useSortableData(messageLog);
  
  const filteredAndSortedLog = useMemo(() => {
    return sortedMessageLog
      .filter(log => {
        // Status filter
        return statusFilter === 'All' || log.status === statusFilter;
      })
      .filter(log => {
        // Search filter (checks recipient, sender, and error)
        const search = tableSearch.toLowerCase();
        return (
          log.recipient.toLowerCase().includes(search) ||
          log.sender.toLowerCase().includes(search) ||
          (log.errorMessage && log.errorMessage.toLowerCase().includes(search))
        );
      });
  }, [sortedMessageLog, statusFilter, tableSearch]);

  // --- NEW: Helper function to get sorting indicator ---
  const getSortIndicator = (key) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction === 'ascending' ? ' ▲' : ' ▼';
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", padding: '24px' }}>
      <h2 style={{ fontWeight: 700, fontSize: 28, marginBottom: 20 }}>Campaign Analytics Dashboard</h2>
      
      {/* --- ANALYSIS MODE TOGGLE (no changes) --- */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
        <button onClick={() => setAnalysisMode('single')} style={{ fontWeight: analysisMode === 'single' ? 700 : 500, background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: analysisMode === 'single' ? '#2563eb' : '#334155' }}>Single Campaign</button>
        <button onClick={() => setAnalysisMode('dateRange')} style={{ fontWeight: analysisMode === 'dateRange' ? 700 : 500, background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', color: analysisMode === 'dateRange' ? '#2563eb' : '#334155' }}>Date Range</button>
      </div>

      {/* --- CONDITIONAL UI RENDERING (no changes) --- */}
      {analysisMode === 'single' ? (
        // --- SINGLE CAMPAIGN VIEW ---
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 24 }}>
          <label style={{ fontWeight: 600, fontSize: 16 }}>Select Campaign:</label>
          <select value={singleCampaignId} onChange={(e) => setSingleCampaignId(e.target.value)} style={{ flexGrow: 1, maxWidth: '500px', padding: '8px 12px', fontSize: 16, borderRadius: 8, border: '1px solid #cbd5e1' }}>
            {allCampaigns.map((c) => (<option key={c.campaignId} value={c.campaignId}>{c.originalFilename} ({new Date(c.uploadedAt).toLocaleString()})</option>))}
          </select>
          {singleCampaignId && <a href={`http://localhost:3000/api/download-campaign/${singleCampaignId}`} download title="Download original campaign file" style={{ color: '#475569' }}><FiDownload size={20} /></a>}
        </div>
      ) : (
        // --- DATE RANGE & MULTI-SELECT VIEW (no changes) ---
        <div style={{ marginBottom: 24, background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '4px', fontSize: '14px' }}>Start Date:</label>
                    <DatePicker selected={startDate} onChange={(date) => setStartDate(date)} dateFormat="MM/dd/yyyy" className="date-picker"/>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '4px', fontSize: '14px' }}>End Date:</label>
                    <DatePicker selected={endDate} onChange={(date) => setEndDate(date)} dateFormat="MM/dd/yyyy" className="date-picker"/>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: '200px' }}>
                    <label style={{ marginBottom: '4px', fontSize: '14px' }}>Search by filename:</label>
                    <div style={{ position: 'relative' }}>
                        <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}/>
                        <input type="text" placeholder="Filter..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '8px 8px 8px 34px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}/>
                    </div>
                </div>
                <button onClick={handleAnalyzeDateRange} disabled={loading || selectedCampaignIds.size === 0} style={{ padding: '8px 16px', height:'39px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0 }}>
                    Analyze Selected
                </button>
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white' }}>
                <div style={{padding: '8px', display:'flex', justifyContent:'flex-end', borderBottom: '1px solid #e2e8f0'}}>
                    <button onClick={selectAllFiltered} style={{background:'transparent', border:'none', color:'#2563eb', cursor:'pointer'}}>Select All</button>
                    <button onClick={() => setSelectedCampaignIds(new Set())} style={{background:'transparent', border:'none', color:'#2563eb', cursor:'pointer', marginLeft:'10px'}}>Deselect All</button>
                </div>
                {filteredCampaigns.map(c => (
                <div key={c.campaignId} style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="checkbox" id={c.campaignId} checked={selectedCampaignIds.has(c.campaignId)} onChange={() => toggleCampaignSelection(c.campaignId)} style={{ marginRight: '10px' }}/>
                    <label htmlFor={c.campaignId}>{c.originalFilename} ({new Date(c.uploadedAt).toLocaleDateString()})</label>
                </div>
                ))}
            </div>
        </div>
      )}

      {/* --- DASHBOARD DISPLAY (no changes) --- */}
      {loading ? <p>Loading dashboard...</p> : (
        <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '30px' }}>
                <StatCard icon={<FiMail size={24}/>} title="Total Messages" value={campaignStats.total} color="#3B82F6" />
                <StatCard icon={<FiCheckCircle size={24}/>} title="Sent" value={campaignStats.sent} color="#22C55E" />
                <StatCard icon={<FiXCircle size={24}/>} title="Failed" value={campaignStats.failed} color="#EF4444" />
                <StatCard icon={<FiPercent size={24}/>} title="Success Rate" value={`${campaignStats.successRate}%`} color="#F59E0B" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'flex-start' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <h3 style={{marginTop: 0, marginBottom: '20px'}}>Status Breakdown</h3>
                    {campaignStats.total > 0 ? <Pie data={pieChartData} /> : <p>No data to display.</p>}
                </div>

                {/* --- NEW: UPGRADED LOG TABLE --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* --- NEW: Filter and Search Bar --- */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                            <option value="All">All Statuses</option>
                            <option value="Sent">Sent</option>
                            <option value="Failed">Failed</option>
                            <option value="Pending">Pending</option>
                        </select>
                        <div style={{ position: 'relative', flexGrow: 1 }}>
                            <FiSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}/>
                            <input
                                type="text"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                placeholder="Search by recipient, sender, or error..."
                                style={{ width: '100%', padding: '8px 8px 8px 34px', borderRadius: 8, border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    {/* --- Log Table Container --- */}
                    <div style={{ 
                        backgroundColor: '#fff', 
                        borderRadius: '12px', 
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        height: '420px',
                        overflowY: 'auto'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8fafc' }}>
                                <tr>
                                    {/* --- NEW: Clickable Headers for Sorting --- */}
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => requestSort('sender')}>
                                        From (Employee){getSortIndicator('sender')}
                                    </th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => requestSort('recipient')}>
                                        Recipient{getSortIndicator('recipient')}
                                    </th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => requestSort('status')}>
                                        Status{getSortIndicator('status')}
                                    </th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, cursor: 'pointer' }} onClick={() => requestSort('timestamp')}>
                                        Timestamp{getSortIndicator('timestamp')}
                                    </th>
                                    <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedLog.length > 0 ? filteredAndSortedLog.map((log) => (
                                    <tr key={log.logId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        {/* --- NEW: Added "sender" column --- */}
                                        <td style={{ padding: '12px 16px' }}>{log.sender}</td>
                                        <td style={{ padding: '12px 16px' }}>{log.recipient}</td>
                                        <td style={{ padding: '12px 16px', fontWeight: 'bold', color: log.status === 'Sent' ? '#22C55E' : log.status === 'Failed' ? '#EF4444' : '#64748B' }}>
                                            {log.status}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                        <td style={{ padding: '12px 16px', color: '#EF4444', fontSize: '14px' }}>{log.errorMessage || 'N/A'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                            No message logs match your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
      )}
       <style>{`
        .date-picker {
            padding: 8px 12px;
            font-size: 16px;
            border-radius: 8px;
            border: 1px solid #cbd5e1;
            width: 150px;
        }
      `}</style>
    </div>
  );
}