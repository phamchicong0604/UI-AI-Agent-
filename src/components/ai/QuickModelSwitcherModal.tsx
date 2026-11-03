import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { selectAiModel, saveAiModelEffort } from '../../common/services/api';
import { ReasoningEffortLevel } from '../../types';
import { Terminal, Check, X, Sparkles, Cpu, Layers } from 'lucide-react';

export interface CliModelEntry {
  id: string;
  name: string;
  provider: 'google' | 'anthropic' | 'openai';
  effort: ReasoningEffortLevel;
  baseId: string;
  category: 'reasoning' | 'fast' | 'flagship';
}

export const KNOWN_AGY_MODELS: CliModelEntry[] = [
  { id: 'gemini-4-argon-medium', name: 'Gemini 4 Argon (Medium)', provider: 'google', effort: 'medium', baseId: 'gemini-4-argon', category: 'reasoning' },
  { id: 'gemini-4-argon-high', name: 'Gemini 4 Argon (High)', provider: 'google', effort: 'high', baseId: 'gemini-4-argon', category: 'reasoning' },
  { id: 'gemini-4-argon-low', name: 'Gemini 4 Argon (Low)', provider: 'google', effort: 'low', baseId: 'gemini-4-argon', category: 'fast' },
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', provider: 'google', effort: 'high', baseId: 'gemini-3.8-flash', category: 'flagship' },
  { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)', provider: 'google', effort: 'medium', baseId: 'gemini-3.8-flash', category: 'fast' },
  { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)', provider: 'google', effort: 'low', baseId: 'gemini-3.8-flash', category: 'fast' },
  { id: 'claude-opus-5-5-low', name: 'Claude Opus 5.5 (Low)', provider: 'anthropic', effort: 'low', baseId: 'claude-opus-5-5', category: 'reasoning' },
  { id: 'claude-opus-5-5-medium', name: 'Claude Opus 5.5 (Medium)', provider: 'anthropic', effort: 'medium', baseId: 'claude-opus-5-5', category: 'reasoning' },
  { id: 'claude-opus-5-5-high', name: 'Claude Opus 5.5 (High)', provider: 'anthropic', effort: 'high', baseId: 'claude-opus-5-5', category: 'reasoning' },
  { id: 'claude-sonnet-5-5-low', name: 'Claude Sonnet 5.5 (Low)', provider: 'anthropic', effort: 'low', baseId: 'claude-sonnet-5-5', category: 'fast' },
  { id: 'claude-sonnet-5-5-medium', name: 'Claude Sonnet 5.5 (Medium)', provider: 'anthropic', effort: 'medium', baseId: 'claude-sonnet-5-5', category: 'flagship' },
  { id: 'claude-sonnet-5-5-high', name: 'Claude Sonnet 5.5 (High)', provider: 'anthropic', effort: 'high', baseId: 'claude-sonnet-5-5', category: 'reasoning' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', provider: 'openai', effort: 'medium', baseId: 'gpt-oss-120b', category: 'flagship' }
];

interface QuickModelSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModelId?: string;
  onModelSelected?: (modelId: string, effort: ReasoningEffortLevel) => void;
}

export const QuickModelSwitcherModal: React.FC<QuickModelSwitcherModalProps> = ({
  isOpen,
  onClose,
  currentModelId = 'gemini-3.8-flash-medium',
  onModelSelected
}) => {
  const { logAudit, reloadAiConfig, aiConfig } = useApp();
  const [filterText, setFilterText] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isApplying, setIsApplying] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeModelId = aiConfig?.model || currentModelId;

  const filteredModels = KNOWN_AGY_MODELS.filter(m =>
    m.name.toLowerCase().includes(filterText.toLowerCase()) ||
    m.id.toLowerCase().includes(filterText.toLowerCase()) ||
    m.effort.toLowerCase().includes(filterText.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setFilterText('');
      const initialIdx = KNOWN_AGY_MODELS.findIndex(m => m.id === activeModelId);
      setSelectedIndex(initialIdx >= 0 ? initialIdx : 0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, activeModelId]);

  useEffect(() => {
    // Keep selected item within bounds
    if (selectedIndex >= filteredModels.length) {
      setSelectedIndex(Math.max(0, filteredModels.length - 1));
    }
  }, [filteredModels.length, selectedIndex]);

  useEffect(() => {
    // Auto-scroll selected element into view
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleSelect = async (item: CliModelEntry) => {
    setIsApplying(true);
    try {
      // 1. Persist model selection to backend SQLite
      await selectAiModel({
        provider: item.provider,
        modelId: item.id,
        effortLevel: item.effort
      });

      // 2. Persist per-model effort
      await saveAiModelEffort({
        provider: item.provider,
        modelId: item.baseId,
        effortLevel: item.effort,
        resolvedVariant: item.id
      });

      logAudit(
        'Switch AI Model',
        'Document',
        item.id,
        `Kích hoạt mô hình "${item.name}" (Effort: ${item.effort.toUpperCase()}) qua /model`
      );

      if (reloadAiConfig) {
        await reloadAiConfig();
      }

      if (onModelSelected) {
        onModelSelected(item.id, item.effort);
      }

      setSuccessToast(`Đã chuyển sang ${item.name}!`);
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 600);
    } catch (err: any) {
      console.error('Failed to apply model:', err);
      if (onModelSelected) {
        onModelSelected(item.id, item.effort);
      }
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredModels.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + Math.max(1, filteredModels.length)) % Math.max(1, filteredModels.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredModels[selectedIndex]) {
        handleSelect(filteredModels[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredModels[selectedIndex]) {
        setFilterText(filteredModels[selectedIndex].id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentActiveEntry = KNOWN_AGY_MODELS.find(m => m.id === activeModelId) || KNOWN_AGY_MODELS[4];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-sm border-t-2 border-t-purple-500 ring-1 ring-purple-500/20"
        onKeyDown={handleKeyDown}
      >
        {/* Terminal Header */}
        <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Terminal className="w-4 h-4 text-purple-400" />
            <span className="text-slate-300 font-semibold">Antigravity CLI Model Switcher</span>
            <span className="text-slate-500">·</span>
            <span className="text-purple-400 font-mono">/model</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Input (styled like > /model [filter]) */}
        <div className="p-3.5 bg-slate-950 border-b border-slate-800/80 flex items-center gap-2 text-slate-200">
          <span className="text-indigo-400 font-bold select-none">&gt;</span>
          <span className="text-purple-300 font-bold select-none">/model</span>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="[gõ để tìm model hoặc nhấn phím ↑/↓]..."
              className="w-full bg-transparent border-none outline-none text-white placeholder-slate-600 font-mono text-xs sm:text-sm pl-1"
            />
          </div>
          <span className="text-[11px] text-slate-500 select-none">
            {filteredModels.length} / {KNOWN_AGY_MODELS.length}
          </span>
        </div>

        {/* Success Toast Banner */}
        {successToast && (
          <div className="px-4 py-2 bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{successToast}</span>
          </div>
        )}

        {/* Models List (Terminal Style with `>` cursor and ID column) */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 bg-slate-950/90 select-none"
        >
          {filteredModels.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs font-sans">
              Không tìm thấy model nào khớp với từ khóa "{filterText}".
            </div>
          ) : (
            filteredModels.map((item, idx) => {
              const isHighlighted = idx === selectedIndex;
              const isCurrent = item.id === activeModelId;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors ${
                    isHighlighted
                      ? 'bg-purple-950/60 text-purple-200 border border-purple-500/40'
                      : isCurrent
                      ? 'bg-slate-900/60 text-slate-200 border border-slate-800'
                      : 'text-slate-400 hover:bg-slate-900/40 border border-transparent'
                  }`}
                >
                  {/* Left: Pointer `>` and Display Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`font-bold transition-opacity ${
                        isHighlighted ? 'text-cyan-400 opacity-100' : isCurrent ? 'text-emerald-400 opacity-100' : 'opacity-0'
                      }`}
                    >
                      &gt;
                    </span>
                    <span
                      className={`font-semibold truncate ${
                        isHighlighted ? 'text-white' : isCurrent ? 'text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {item.name}
                    </span>

                    {/* Badge for Current Active */}
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-sans shrink-0">
                        Đang dùng
                      </span>
                    )}

                    {/* Category pill */}
                    <span
                      className={`hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-sans shrink-0 ${
                        item.category === 'reasoning'
                          ? 'bg-purple-900/40 text-purple-300 border border-purple-700/30'
                          : item.category === 'flagship'
                          ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/30'
                          : 'bg-cyan-900/40 text-cyan-300 border border-cyan-700/30'
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  {/* Right: Technical ID (Identical to CLI) */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[11px] text-slate-500 group-hover:text-slate-400">
                      {item.id}
                    </span>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Terminal Footer (Identical to Screenshot) */}
        <div className="bg-slate-900/90 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 select-none">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold">↑/↓</span>
            <span>Navigate</span>
            <span className="text-slate-600">·</span>
            <span className="text-purple-300 font-bold">enter</span>
            <span>Select</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-300 font-bold">tab</span>
            <span>Complete</span>
          </div>

          <div className="flex items-center gap-2 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">
              {currentActiveEntry.name.replace(/\s*\(.*?\)/, '')}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-purple-300 font-mono">{currentActiveEntry.effort}</span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">agy subscription</span>
          </div>
        </div>
      </div>
    </div>
  );
};
