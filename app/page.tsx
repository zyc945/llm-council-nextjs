'use client';

import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import ModelConfigModal, {
  ModelOption,
} from './components/ModelConfigModal';
import { api } from './lib/api';
import './page.css';
import type { ModelConfigInput } from './types/modelConfig';

const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createModelConfig = (overrides: Partial<ModelConfigInput> = {}): ModelConfigInput => ({
  id: overrides.id ?? generateId(),
  model: overrides.model ?? '',
  systemPrompt: overrides.systemPrompt ?? '',
});

export default function Home() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modelConfigs, setModelConfigs] = useState<ModelConfigInput[]>([]);
  const [chairmanModel, setChairmanModel] = useState<string | null>(null);
  const [defaultChairmanModel, setDefaultChairmanModel] = useState<string>('openai/gpt-4o');
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);

  const [mode, setMode] = useState<'council' | 'roundtable'>('council');

  // Load conversations and default models on mount
  useEffect(() => {
    loadConversations();
    loadInitialModels();

    return () => {
      streamControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load conversation details when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadInitialModels = async () => {
    try {
      const config = await api.getConfig();
      const defaults =
        config?.council_models?.map((cfg: any) =>
          createModelConfig({
            model: cfg.model,
            systemPrompt: cfg.systemPrompt || '',
          })
        ) ?? [];
      const fallbackChairman = config?.chairman_model || 'openai/gpt-4o';
      setDefaultChairmanModel(fallbackChairman);
      setChairmanModel(fallbackChairman);
      setModelConfigs(
        defaults.length > 0
          ? defaults
          : [createModelConfig({ model: 'openai/gpt-4o' })]
      );
    } catch (error) {
      console.error('Failed to load council configuration:', error);
      setModelConfigs((prev) =>
        prev.length > 0 ? prev : [createModelConfig()]
      );
    }
  };

  const loadAvailableModels = async () => {
    try {
      setModelsError(null);
      setIsModelsLoading(true);
      const data = await api.listModels();
      setAvailableModels(data.models || []);
    } catch (error) {
      console.error('Failed to load models:', error);
      setModelsError('加载 OpenRouter 模型列表失败，请稍后重试');
    } finally {
      setIsModelsLoading(false);
    }
  };

  const loadConversation = async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
      if (conv.mode) {
        setMode(conv.mode);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    // Open the config modal first to let user choose mode and models
    setIsConfigModalOpen(true);
    if (availableModels.length === 0 && !isModelsLoading) {
      loadAvailableModels();
    }
    // Note: The actual creation will happen after saving config OR on first message
  };

  const createConversationAndSaveConfig = async (configData: {
    configs: ModelConfigInput[];
    chairmanModel: string | null;
    mode: 'council' | 'roundtable';
  }) => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        { id: newConv.id, created_at: newConv.created_at, title: newConv.title, message_count: 0 },
        ...conversations,
      ]);

      // Update local state
      setModelConfigs(configData.configs);
      setChairmanModel(configData.chairmanModel);
      setMode(configData.mode);

      // Select the new conversation
      setCurrentConversationId(newConv.id);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error('Failed to create conversation with config:', error);
    }
  };

  const handleSelectConversation = (id: string) => {
    if (id === currentConversationId) return;
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setIsLoading(false);
    setCurrentConversationId(id);
  };

  const handleOpenModelConfig = () => {
    setIsConfigModalOpen(true);
    if (availableModels.length === 0 && !isModelsLoading) {
      loadAvailableModels();
    }
  };

  const handleCloseModelConfig = () => {
    setIsConfigModalOpen(false);
  };

  const handleSaveModelConfigs = (data: {
    configs: ModelConfigInput[];
    chairmanModel: string | null;
    mode: 'council' | 'roundtable';
  }) => {
    // If we were on an empty screen or about to start a new one, create it now
    if (!currentConversationId || (currentConversation && currentConversation.messages.length === 0)) {
      createConversationAndSaveConfig(data);
    } else {
      // Just update config for current conversation
      setModelConfigs(data.configs);
      setChairmanModel(data.chairmanModel);
      setMode(data.mode);
      setIsConfigModalOpen(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentConversationId || !currentConversation) return;

    const activeModels = modelConfigs
      .map((cfg) => ({
        model: cfg.model.trim(),
        systemPrompt: cfg.systemPrompt.trim(),
      }))
      .filter((cfg) => cfg.model.length > 0)
      .map((cfg) => ({
        model: cfg.model,
        systemPrompt: cfg.systemPrompt || undefined,
      }));

    if (activeModels.length === 0) {
      alert('请至少配置一个模型');
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();
    streamControllerRef.current?.abort();
    streamControllerRef.current = controller;

    const activeChairmanModel =
      chairmanModel && chairmanModel.trim().length > 0
        ? chairmanModel.trim()
        : defaultChairmanModel;

    try {
      // Optimistically add user message to UI
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, userMessage],
        };
      });

      // Create a partial assistant message that will be updated progressively
      const assistantMessage: any = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        roundtable_turns: [],
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
          roundtable: mode === 'roundtable',
        },
      };

      // Add the partial assistant message
      setCurrentConversation((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, assistantMessage],
        };
      });

      // Send message with streaming
      await api.sendMessageStream(
        currentConversationId,
        content,
        activeModels,
        activeChairmanModel,
        (eventType, event) => {
          switch (eventType) {
            case 'roundtable_start':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.loading = { roundtable: true };
                lastMsg.roundtable_turns = [];
                return { ...prev, messages };
              });
              break;

            case 'roundtable_turn_start':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.current_speaker = {
                  model_id: event.model_id,
                  model_name: event.model_name,
                };
                return { ...prev, messages };
              });
              break;

            case 'roundtable_turn_complete':
              console.log('[DEBUG] roundtable_turn_complete event received:', {
                turn_id: event.turn_id,
                model_id: event.model_id,
                model_name: event.model_name,
                content_preview: event.data?.substring(0, 50)
              });

              setCurrentConversation((prev: any) => {
                if (!prev) return prev;

                // Deep clone messages array to ensure immutability
                const messages = [...prev.messages];
                const lastIndex = messages.length - 1;
                if (lastIndex < 0) return prev;

                // Clone the message object we're updating
                const lastMsg = { ...messages[lastIndex] };

                // Get existing turns and check for duplicates by turn ID (now guaranteed unique)
                const existingTurns = lastMsg.roundtable_turns || [];
                console.log('[DEBUG] Existing turns count:', existingTurns.length);
                console.log('[DEBUG] Existing turn IDs:', existingTurns.map((t: any) => t.id));

                // Check if this turn_id already exists
                const isDuplicate = existingTurns.some(
                  (t: any) => t.id === event.turn_id
                );

                if (isDuplicate) {
                  console.log('[DEBUG] DUPLICATE DETECTED (turn_id exists) - skipping');
                  return prev;
                }

                console.log('[DEBUG] Adding new turn with ID:', event.turn_id);
                lastMsg.roundtable_turns = [
                  ...existingTurns,
                  {
                    id: event.turn_id,
                    role: 'assistant',
                    model_id: event.model_id,
                    model_name: event.model_name || event.model_id.split('/')[1] || event.model_id,
                    content: event.data,
                    timestamp: new Date().toISOString()
                  },
                ];
                lastMsg.current_speaker = null;
                messages[lastIndex] = lastMsg;

                return { ...prev, messages };
              });
              break;

            case 'roundtable_complete':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.loading.roundtable = false;
                return { ...prev, messages };
              });
              break;

            case 'stage1_start':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.loading.stage1 = true;
                return { ...prev, messages };
              });
              break;

            case 'stage1_complete':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.stage1 = event.data;
                lastMsg.loading.stage1 = false;
                return { ...prev, messages };
              });
              break;

            case 'stage2_start':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.loading.stage2 = true;
                return { ...prev, messages };
              });
              break;

            case 'stage2_complete':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.stage2 = event.data;
                lastMsg.metadata = event.metadata;
                lastMsg.loading.stage2 = false;
                return { ...prev, messages };
              });
              break;

            case 'stage3_start':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.loading.stage3 = true;
                return { ...prev, messages };
              });
              break;

            case 'stage3_complete':
              setCurrentConversation((prev: any) => {
                if (!prev) return prev;
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                if (!lastMsg) return prev;
                lastMsg.stage3 = event.data;
                lastMsg.loading.stage3 = false;
                return { ...prev, messages };
              });
              break;

            case 'title_complete':
              // We only reload the list, not the current conversation object
              // to prevent React state reset issues
              api.listConversations().then(list => setConversations(list));
              break;

            case 'complete':
              // Stream complete, just refresh the sidebar list
              api.listConversations().then(list => setConversations(list));
              break;

            case 'error':
              console.error('Stream error:', event.message);
              break;

            default:
              console.log('Unknown event type:', eventType);
          }
        },
        controller.signal,
        mode
      );
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.warn('Stream aborted.');
      } else {
        console.error('Failed to send message:', error);
        // Remove optimistic messages on error
        setCurrentConversation((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.slice(0, -2),
          };
        });
      }
    } finally {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onOpenModelConfig={handleOpenModelConfig}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
      <ModelConfigModal
        isOpen={isConfigModalOpen}
        onClose={handleCloseModelConfig}
        onSave={handleSaveModelConfigs}
        initialConfigs={modelConfigs}
        availableModels={availableModels}
        chairmanModel={chairmanModel}
        defaultChairmanModel={defaultChairmanModel}
        initialMode={mode}
        isLoading={isModelsLoading}
        errorMessage={modelsError}
        onRetryFetch={loadAvailableModels}
      />
    </div>
  );
}

