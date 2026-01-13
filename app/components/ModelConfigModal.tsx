'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ModelConfigInput } from '../types/modelConfig';
import './ModelConfigModal.css';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  pricing?: string | null;
  context_length?: number | null;
  tags?: string[];
}

interface ModelConfigModalProps {
  isOpen: boolean;
  initialConfigs: ModelConfigInput[];
  availableModels: ModelOption[];
  chairmanModel: string | null;
  defaultChairmanModel: string;
  isLoading: boolean;
  errorMessage?: string | null;
  onRetryFetch: () => void;
  onClose: () => void;
  onSave: (data: {
    configs: ModelConfigInput[];
    chairmanModel: string | null;
    mode: 'council' | 'roundtable';
  }) => void;
  initialMode?: 'council' | 'roundtable';
}

export default function ModelConfigModal({
  isOpen,
  initialConfigs,
  availableModels,
  isLoading,
  chairmanModel,
  defaultChairmanModel,
  initialMode = 'council',
  errorMessage,
  onRetryFetch,
  onClose,
  onSave,
}: ModelConfigModalProps) {
  const [search, setSearch] = useState('');
  const [draftConfigs, setDraftConfigs] = useState<ModelConfigInput[]>(initialConfigs);
  const [draftChairman, setDraftChairman] = useState<string>(
    chairmanModel || ''
  );
  const [draftMode, setDraftMode] = useState<'council' | 'roundtable'>(initialMode);

  useEffect(() => {
    if (isOpen) {
      setDraftConfigs(initialConfigs.map((cfg) => ({ ...cfg })));
      setDraftChairman(chairmanModel || '');
      setDraftMode(initialMode);
      setSearch('');
    }
  }, [initialConfigs, chairmanModel, initialMode, isOpen]);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return availableModels;
    return availableModels.filter((option) => {
      const haystack = `${option.name} ${option.id} ${option.description || ''}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [availableModels, normalizedSearch]);

  const isSelected = (modelId: string) =>
    draftConfigs.some((cfg) => cfg.model === modelId);

  const toggleChairman = (modelId: string) => {
    // If clicking the current chairman, unset it
    if (draftChairman === modelId) {
      setDraftChairman('');
    } else {
      setDraftChairman(modelId);
    }
  };

  const toggleModel = (modelId: string) => {
    setDraftConfigs((prev) => {
      const exists = prev.some((cfg) => cfg.model === modelId);
      if (exists) {
        // If removing a model that's the chairman, also clear chairman
        if (draftChairman === modelId) {
          setDraftChairman('');
        }
        return prev.filter((cfg) => cfg.model !== modelId);
      }
      return [
        ...prev,
        {
          id: modelId,
          model: modelId,
          systemPrompt: '',
        },
      ];
    });
  };

  const handlePromptChange = (modelId: string, value: string) => {
    setDraftConfigs((prev) =>
      prev.map((cfg) =>
        cfg.model === modelId ? { ...cfg, systemPrompt: value } : cfg
      )
    );
  };

  const handleSave = () => {
    const sanitized = draftConfigs.map((cfg) => ({
      ...cfg,
      systemPrompt: cfg.systemPrompt.trim(),
    }));
    const normalizedChairman = draftChairman.trim();
    onSave({
      configs: sanitized,
      chairmanModel: normalizedChairman.length > 0 ? normalizedChairman : null,
      mode: draftMode,
    });
  };

  const catalogModels = useMemo(
    () => new Map(availableModels.map((m) => [m.id, m])),
    [availableModels]
  );

  const disableSave = draftConfigs.length === 0;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-container">
        <div className="modal-header">
          <div>
            <h2>配置模型</h2>
            <p>从 OpenRouter 列表中选择用于本次会话的模型，并可为每个模型提供 System Prompt。</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-controls">
            <div className="mode-selector">
              <label className={draftMode === 'council' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  value="council"
                  checked={draftMode === 'council'}
                  onChange={() => setDraftMode('council')}
                />
                Council (3-Stage)
              </label>
              <label className={draftMode === 'roundtable' ? 'active' : ''}>
                <input
                  type="radio"
                  name="mode"
                  value="roundtable"
                  checked={draftMode === 'roundtable'}
                  onChange={() => setDraftMode('roundtable')}
                />
                Roundtable (Discussion)
              </label>
            </div>
            <input
              className="search-input"
              placeholder="搜索模型名称或 ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={isLoading}
            />
            <div className="modal-meta">
              已选择 {draftConfigs.length} 个模型
            </div>
          </div>

          {isLoading && (
            <div className="modal-status">正在加载 OpenRouter 模型列表...</div>
          )}

          {errorMessage && (
            <div className="modal-error">
              <span>{errorMessage}</span>
              <button className="link-button" onClick={onRetryFetch}>
                重试
              </button>
            </div>
          )}

          {!isLoading && !errorMessage && (
            <>
            <div className="modal-content">
              <div className="model-list">
                {filteredOptions.length === 0 ? (
                  <div className="modal-status">无匹配结果</div>
                ) : (
                  filteredOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`model-item ${
                        isSelected(option.id) ? 'selected' : ''
                      }`}
                    >
                      <div className="model-item-header">
                        <input
                          type="checkbox"
                          checked={isSelected(option.id)}
                          onChange={() => toggleModel(option.id)}
                        />
                        <div>
                          <div className="model-name">{option.name}</div>
                          <div className="model-id">{option.id}</div>
                        </div>
                      </div>
                      {option.description && (
                        <p className="model-description">{option.description}</p>
                      )}
                      <div className="model-tags">
                        {option.pricing && (
                          <span className="model-tag">
                            Prompt: {option.pricing}
                          </span>
                        )}
                        {option.context_length && (
                          <span className="model-tag">
                            Context: {option.context_length}
                          </span>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div className="selected-list">
                {draftConfigs.length === 0 ? (
                  <div className="modal-status">
                    勾选上方列表中的模型后，可在此设置 System Prompt 和主席角色。
                  </div>
                ) : (
                  draftConfigs.map((cfg) => {
                    const option = catalogModels.get(cfg.model);
                    const isChairman = draftChairman === cfg.model;
                    return (
                      <div key={cfg.id} className={`selected-item ${isChairman ? 'is-chairman' : ''}`}>
                        <div className="selected-item-header">
                          <div>
                            <div className="model-name-row">
                              <div className="model-name">
                                {option?.name || cfg.model}
                              </div>
                              {isChairman && (
                                <span className="chairman-badge">主席</span>
                              )}
                            </div>
                            <div className="model-id">{cfg.model}</div>
                          </div>
                          <div className="item-actions">
                            <button
                              className={`chairman-toggle-btn ${isChairman ? 'active' : ''}`}
                              onClick={() => toggleChairman(cfg.model)}
                              aria-label={isChairman ? "取消主席" : "设为主席"}
                              title={isChairman ? "取消主席" : "设为主席"}
                            >
                              {isChairman ? '👑' : '♔'}
                            </button>
                            <button
                              className="remove-btn"
                              onClick={() => toggleModel(cfg.model)}
                              aria-label="移除该模型"
                            >
                              移除
                            </button>
                          </div>
                        </div>
                        <textarea
                          className="prompt-textarea"
                          placeholder="可选：为该模型提供定制的 System Prompt"
                          value={cfg.systemPrompt}
                          onChange={(e) =>
                            handlePromptChange(cfg.model, e.target.value)
                          }
                          rows={3}
                        />
                        {!option && (
                          <div className="model-hint">
                            该模型暂未在 OpenRouter 列表中显示，将按手动输入的 ID 调用。
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            {/* Chairman hint for Council mode */}
            {draftMode === 'council' && (
              <div className="chairman-info">
                <span className="chairman-info-icon">ℹ️</span>
                <div className="chairman-info-text">
                  <strong>关于主席模型：</strong>
                  点击右侧已选模型旁的 ♔ 图标可设为主席。
                  {!draftChairman && ` 未设置时将使用默认：${defaultChairmanModel}`}
                </div>
              </div>
            )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary-btn" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-btn"
            onClick={handleSave}
            disabled={disableSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}


