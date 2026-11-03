import React from 'react';
import { I18nProvider } from './common/i18n/I18nContext';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { DocumentsView } from './components/documents/DocumentsView';
import { RequirementsView } from './components/requirements/RequirementsView';
import { EvidenceView } from './components/evidence/EvidenceView';
import { TestCasesView } from './components/testcases/TestCasesView';
import { TestRunsView } from './components/testruns/TestRunsView';
import { BugsView } from './components/bugs/BugsView';
import { TraceabilityView } from './components/traceability/TraceabilityView';
import { SettingsView } from './components/settings/SettingsView';
import { AiAssistantModal } from './components/ai/AiAssistantModal';
import { ChangeImpactModal } from './components/ai/ChangeImpactModal';
import { QuickModelSwitcherModal } from './components/ai/QuickModelSwitcherModal';

const MainLayout: React.FC = () => {
  const { activeTab, isModelSwitcherOpen, setIsModelSwitcherOpen } = useApp();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Support Alt+M or Ctrl+Shift+M or Cmd+Shift+M to quickly trigger /model switcher
      if ((e.altKey && e.key.toLowerCase() === 'm') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm')) {
        e.preventDefault();
        setIsModelSwitcherOpen(!isModelSwitcherOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModelSwitcherOpen, setIsModelSwitcherOpen]);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'documents' && <DocumentsView />}
            {activeTab === 'requirements' && <RequirementsView />}
            {activeTab === 'evidence' && <EvidenceView />}
            {activeTab === 'testcases' && <TestCasesView />}
            {activeTab === 'testruns' && <TestRunsView />}
            {activeTab === 'bugs' && <BugsView />}
            {activeTab === 'traceability' && <TraceabilityView />}
            {activeTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Global Modals */}
      <AiAssistantModal />
      <ChangeImpactModal />
      <QuickModelSwitcherModal
        isOpen={isModelSwitcherOpen}
        onClose={() => setIsModelSwitcherOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </I18nProvider>
  );
};

export default App;
