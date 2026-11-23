import React, { useState, useEffect, useCallback } from 'react';
import SidebarNav from './components/SidebarNav';
import TicketList from './components/TicketList';
import TicketDetail from './components/TicketDetail';
import NewTicketModal from './components/NewTicketModal';
import {
  fetchAgents,
  loginAgent,
  fetchTickets,
  fetchTicket,
  createTicket,
  assignTicket,
  updatePriority,
  updateStatus,
  postComment,
  reopenTicket,
  fetchAuditTrail,
  fetchExport
} from './api';

export default function App() {
  const [agents, setAgents] = useState([]);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [exportData, setExportData] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'me', 'unassigned', 'late', 'waiting'
  const [activePriority, setActivePriority] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState(false);

  // 1. Initial Load: Agents and default login
  useEffect(() => {
    async function init() {
      try {
        const agentList = await fetchAgents();
        setAgents(agentList);

        // Default to Meera Nair (Lead)
        const meera = agentList.find((a) => a.id === 1) || agentList[0];
        if (meera) {
          const authData = await loginAgent(meera.id);
          setCurrentAgent(authData.agent);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      }
    }
    init();
  }, []);

  // 2. Load tickets whenever filters or agent changes
  const loadTickets = useCallback(async () => {
    try {
      const params = {};
      if (activeFilter === 'me') params.assigned_to = 'me';
      else if (activeFilter === 'unassigned') params.assigned_to = 'unassigned';
      else if (activeFilter === 'late') params.breached = 'true';
      else if (activeFilter === 'waiting') params.status = 'waiting_on_customer';

      if (activePriority !== 'all') params.priority = activePriority;
      if (searchTerm) params.search = searchTerm;

      const data = await fetchTickets(params);
      setTickets(data);

      // Auto-select first ticket if none selected
      if (!selectedTicketId && data.length > 0) {
        setSelectedTicketId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    }
  }, [activeFilter, activePriority, searchTerm, selectedTicketId]);

  useEffect(() => {
    if (currentAgent || customerMode) {
      loadTickets();
    }
  }, [loadTickets, currentAgent, customerMode]);

  // 3. Load selected ticket detail, audit log, and export
  const loadSelectedTicket = useCallback(async (id) => {
    if (!id) return;
    try {
      const ticketData = await fetchTicket(id, customerMode);
      setSelectedTicket(ticketData);

      if (!customerMode) {
        const audit = await fetchAuditTrail(id).catch(() => []);
        setAuditTrail(audit);
      } else {
        setAuditTrail([]);
      }

      const exp = await fetchExport(id).catch(() => null);
      setExportData(exp);
    } catch (err) {
      console.error('Failed to load ticket details:', err);
    }
  }, [customerMode]);

  useEffect(() => {
    if (selectedTicketId) {
      loadSelectedTicket(selectedTicketId);
    }
  }, [selectedTicketId, loadSelectedTicket]);

  // 4. Agent Switcher
  const handleSelectAgent = async (agentId) => {
    try {
      const authData = await loginAgent(agentId);
      setCurrentAgent(authData.agent);
    } catch (err) {
      alert('Failed to switch agent: ' + err.message);
    }
  };

  // 5. Actions
  const handleAssignTicket = async (ticketId) => {
    await assignTicket(ticketId);
    await loadTickets();
    await loadSelectedTicket(ticketId);
  };

  const handleUpdateStatus = async (ticketId, status) => {
    await updateStatus(ticketId, status);
    await loadTickets();
    await loadSelectedTicket(ticketId);
  };

  const handleUpdatePriority = async (ticketId, priority) => {
    await updatePriority(ticketId, priority);
    await loadTickets();
    await loadSelectedTicket(ticketId);
  };

  const handlePostComment = async (ticketId, commentData) => {
    await postComment(ticketId, commentData);
    await loadTickets();
    await loadSelectedTicket(ticketId);
  };

  const handleReopenTicket = async (ticketId) => {
    try {
      await reopenTicket(ticketId);
      await loadTickets();
      await loadSelectedTicket(ticketId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateTicket = async (ticketData) => {
    const created = await createTicket(ticketData);
    await loadTickets();
    setSelectedTicketId(created.id);
  };

  // 6. Compute counts for sidebar
  const counts = {
    all: tickets.length,
    me: tickets.filter((t) => currentAgent && t.assigned_to === currentAgent.id).length,
    unassigned: tickets.filter((t) => !t.assigned_to).length,
    late: tickets.filter((t) => t.is_breached || t.sla_reply_breached || t.sla_resolve_breached).length,
    waiting: tickets.filter((t) => t.status === 'waiting_on_customer').length
  };

  return (
    <div className="app-container">
      {/* Sleek Dark Left Navbar */}
      <SidebarNav
        agents={agents}
        currentAgent={currentAgent}
        onSelectAgent={handleSelectAgent}
        onOpenNewTicket={() => setIsNewModalOpen(true)}
        customerMode={customerMode}
        onToggleCustomerMode={() => setCustomerMode(!customerMode)}
        activeFilter={activeFilter}
        onChangeFilter={setActiveFilter}
        activePriority={activePriority}
        onChangePriority={setActivePriority}
        counts={counts}
      />

      {/* Crisp White Workspace (Middle List + Right Details) */}
      <main className="workspace-main">
        <TicketList
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelectTicket={setSelectedTicketId}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />

        <TicketDetail
          ticket={selectedTicket}
          currentAgent={currentAgent}
          customerMode={customerMode}
          onAssign={handleAssignTicket}
          onUpdateStatus={handleUpdateStatus}
          onUpdatePriority={handleUpdatePriority}
          onPostComment={handlePostComment}
          onReopen={handleReopenTicket}
          auditTrail={auditTrail}
          exportData={exportData}
          onRefresh={() => {
            loadTickets();
            if (selectedTicketId) loadSelectedTicket(selectedTicketId);
          }}
        />
      </main>

      <NewTicketModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreate={handleCreateTicket}
      />
    </div>
  );
}
