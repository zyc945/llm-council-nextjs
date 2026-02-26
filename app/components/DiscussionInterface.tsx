'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import SafeMarkdown from './SafeMarkdown';
import './DiscussionInterface.css';

/**
 * Discussion message structure
 */
interface DiscussionMessage {
  id: string;
  round: number;
  speakerId: string;
  speakerName: string;
  speakerNameEn: string;
  speakerAvatar: string;
  speakerColor: string;
  content: string;
  timestamp: number;
}

/**
 * Discussion role configuration
 */
interface AgentRole {
  id: string;
  name: string;
  nameEn: string;
  avatar: string;
  color: string;
}

/**
 * SSE Event types
 */
interface DiscussionEvent {
  type: string;
  round?: number;
  speakerId?: string;
  state?: any;
  reason?: string;
  error?: string;
  data?: any;
}

interface DiscussionInterfaceProps {
  conversationId: string;
  topic: string;
  roles?: AgentRole[];
  maxRounds?: number;
  onComplete?: () => void;
}

export default function DiscussionInterface({
  conversationId,
  topic,
  roles = [],
  maxRounds = 20,
  onComplete,
}: DiscussionInterfaceProps) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [status, setStatus] = useState<'connecting' | 'running' | 'completed' | 'terminated' | 'error'>('connecting');
  const [currentSpeaker, setCurrentSpeaker] = useState<AgentRole | null>(null);
  const [interventionText, setInterventionText] = useState('');
  const [isInterventionPanelOpen, setIsInterventionPanelOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Default roles if none provided
  const defaultRoles: AgentRole[] = [
    { id: 'optimist', name: '乐观主义者', nameEn: 'Optimist', avatar: '☀️', color: '#FFD700' },
    { id: 'pessimist', name: '悲观主义者', nameEn: 'Pessimist', avatar: '🌧️', color: '#708090' },
    { id: 'pragmatist', name: '实用主义者', nameEn: 'Pragmatist', avatar: '🔧', color: '#228B22' },
    { id: 'innovator', name: '创新者', nameEn: 'Innovator', avatar: '💡', color: '#9932CC' },
  ];

  const displayRoles = roles.length > 0 ? roles : defaultRoles;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Start discussion on mount
  useEffect(() => {
    startDiscussion();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const startDiscussion = async () => {
    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch(`/api/discussions/${conversationId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          roles: displayRoles,
          maxRounds,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start discussion');
      }

      setStatus('running');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          try {
            const event: DiscussionEvent = JSON.parse(line.slice(5));
            handleEvent(event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }

      setStatus('completed');
      onComplete?.();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setStatus('terminated');
      } else {
        setErrorMessage(error.message);
        setStatus('error');
      }
    }
  };

  const handleEvent = (event: DiscussionEvent) => {
    console.log('Discussion event:', event);

    switch (event.type) {
      case 'discussion_start':
        setStatus('running');
        break;

      case 'round_start':
        if (event.speakerId) {
          const role = displayRoles.find(r => r.id === event.speakerId);
          if (role) {
            setCurrentSpeaker(role);
          }
        }
        break;

      case 'message_delta':
        // Handle streaming message updates if implemented
        break;

      case 'message_complete':
        if (event.data) {
          setMessages(prev => [...prev, event.data]);
        }
        break;

      case 'round_complete':
        setCurrentSpeaker(null);
        break;

      case 'discussion_complete':
        setStatus('completed');
        break;

      case 'discussion_terminated':
        setStatus('terminated');
        break;

      case 'error':
        setErrorMessage(event.error || 'Unknown error');
        setStatus('error');
        break;
    }
  };

  const handleIntervene = async () => {
    if (!interventionText.trim()) return;

    try {
      const response = await fetch(`/api/discussions/${conversationId}/stream`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: interventionText,
          type: 'redirect',
        }),
      });

      if (response.ok) {
        // Add intervention message to display
        const interventionMessage: DiscussionMessage = {
          id: `intervention-${Date.now()}`,
          round: messages.length + 1,
          speakerId: 'user',
          speakerName: '你',
          speakerNameEn: 'User',
          speakerAvatar: '👤',
          speakerColor: '#3b82f6',
          content: interventionText,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, interventionMessage]);
        setInterventionText('');
        setIsInterventionPanelOpen(false);
      }
    } catch (error: any) {
      console.error('Failed to intervene:', error);
    }
  };

  const handleTerminate = async () => {
    if (!confirm('确定要终止讨论吗？')) return;

    try {
      await fetch(`/api/discussions/${conversationId}/stream`, {
        method: 'DELETE',
      });
      setStatus('terminated');
    } catch (error) {
      console.error('Failed to terminate:', error);
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'connecting': return '连接中...';
      case 'running': return currentSpeaker ? `${currentSpeaker.name} 正在发言...` : '讨论进行中';
      case 'completed': return '讨论已完成';
      case 'terminated': return '讨论已终止';
      case 'error': return `错误：${errorMessage}`;
    }
  };

  return (
    <div className="discussion-interface">
      {/* Header */}
      <div className="discussion-header">
        <div className="discussion-title">
          <span className="status-dot status-{status}"></span>
          {getStatusText()}
        </div>
        <div className="discussion-controls">
          <button
            className="control-button intervene-button"
            onClick={() => setIsInterventionPanelOpen(!isInterventionPanelOpen)}
            disabled={status !== 'running'}
          >
            💬 介入讨论
          </button>
          <button
            className="control-button terminate-button"
            onClick={handleTerminate}
            disabled={status !== 'running'}
          >
            ⏹️ 终止
          </button>
        </div>
      </div>

      {/* Topic display */}
      <div className="topic-display">
        <strong>讨论主题:</strong> {topic}
      </div>

      {/* Messages feed */}
      <div className="message-feed">
        {messages.map((msg, index) => {
          const isUser = msg.speakerId === 'user';
          const role = displayRoles.find(r => r.id === msg.speakerId);
          const isEven = index % 2 === 0;

          return (
            <div
              key={msg.id}
              className={`message-row ${isEven ? 'left' : 'right'} ${isUser ? 'user-message' : ''}`}
            >
              {!isUser && (
                <div className="participant-info">
                  <div
                    className="participant-avatar"
                    style={{ backgroundColor: role?.color || '#888' }}
                  >
                    {role?.avatar || '👤'}
                  </div>
                </div>
              )}

              <div className="message-bubble-wrapper">
                <div className="message-header">
                  <span
                    className="participant-name"
                    style={{ color: role?.color || '#3b82f6' }}
                  >
                    {msg.speakerName}
                  </span>
                  <span className="round-number">第 {msg.round} 轮</span>
                </div>
                <div className="message-bubble">
                  <SafeMarkdown>{msg.content}</SafeMarkdown>
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {currentSpeaker && status === 'running' && (
          <div className={`message-row ${messages.length % 2 === 0 ? 'left' : 'right'} typing`}>
            <div className="participant-info">
              <div
                className="participant-avatar"
                style={{ backgroundColor: currentSpeaker.color, opacity: 0.7 }}
              >
                {currentSpeaker.avatar}
              </div>
            </div>
            <div className="message-bubble-wrapper">
              <div className="message-header">
                <span className="participant-name" style={{ color: currentSpeaker.color }}>
                  {currentSpeaker.name}
                </span>
              </div>
              <div className="message-bubble typing-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Intervention panel */}
      {isInterventionPanelOpen && (
        <div className="intervention-panel">
          <textarea
            className="intervention-input"
            value={interventionText}
            onChange={(e) => setInterventionText(e.target.value)}
            placeholder="输入你想介入的内容..."
            rows={3}
          />
          <div className="intervention-actions">
            <button className="send-button" onClick={handleIntervene}>
              发送
            </button>
            <button
              className="cancel-button"
              onClick={() => {
                setInterventionText('');
                setIsInterventionPanelOpen(false);
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Participants bar */}
      <div className="participants-bar">
        <span className="participants-label">参与者:</span>
        {displayRoles.map(role => (
          <div key={role.id} className="participant-badge">
            <span className="participant-badge-avatar">{role.avatar}</span>
            <span className="participant-badge-name">{role.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
