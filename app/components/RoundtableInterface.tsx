'use client';

import { useMemo } from 'react';
import SafeMarkdown from './SafeMarkdown';
import './RoundtableInterface.css';

interface Turn {
  id: string;
  role: string;
  model_id: string;
  model_name: string;
  content: string;
  is_intervention?: boolean;
}

interface RoundtableInterfaceProps {
  turns: Turn[];
  currentSpeaker?: {
    model_id: string;
    model_name: string;
  } | null;
}

/**
 * Assigns a stable color to each model ID for visual consistency.
 */
function useModelColors(turns: Turn[], currentSpeaker?: any) {
  return useMemo(() => {
    const colors = [
      '#3b82f6', // blue
      '#10b981', // emerald
      '#8b5cf6', // violet
      '#f59e0b', // amber
      '#ef4444', // red
      '#ec4899', // pink
    ];
    const modelIds = Array.from(new Set(turns.map(t => t.model_id)));
    if (currentSpeaker) modelIds.push(currentSpeaker.model_id);

    const colorMap: Record<string, string> = {};
    modelIds.forEach((id, index) => {
      colorMap[id] = colors[index % colors.length];
    });
    return colorMap;
  }, [turns, currentSpeaker]);
}

export default function RoundtableInterface({
  turns,
  currentSpeaker,
}: RoundtableInterfaceProps) {
  const colorMap = useModelColors(turns, currentSpeaker);

  return (
    <div className="roundtable-container">
      <div className="roundtable-header">
        <span className="roundtable-status-dot"></span>
        Roundtable Live Discussion
      </div>

      <div className="discussion-thread">
        {turns.map((turn, index) => {
          return (
          <div
            key={turn.id}
            className={`message-row ${index % 2 === 0 ? 'left' : 'right'} ${turn.is_intervention ? 'intervention' : ''}`}
          >
            <div className="participant-info">
              <div
                className="participant-avatar"
                style={{ backgroundColor: colorMap[turn.model_id] }}
              >
                {turn.model_name.substring(0, 1).toUpperCase()}
              </div>
            </div>

            <div className="message-bubble-wrapper">
              <div className="participant-name" style={{ color: colorMap[turn.model_id] }}>
                {turn.model_name}
              </div>
              <div className="message-bubble">
                <SafeMarkdown>{turn.content}</SafeMarkdown>
              </div>
            </div>
          </div>
          );
        })}

        {currentSpeaker && (
          <div className={`message-row ${turns.length % 2 === 0 ? 'left' : 'right'} typing`}>
            <div className="participant-info">
              <div
                className="participant-avatar"
                style={{ backgroundColor: colorMap[currentSpeaker.model_id], opacity: 0.7 }}
              >
                {currentSpeaker.model_name.substring(0, 1).toUpperCase()}
              </div>
            </div>
            <div className="message-bubble-wrapper">
              <div className="participant-name" style={{ color: colorMap[currentSpeaker.model_id] }}>
                {currentSpeaker.model_name}
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
      </div>
    </div>
  );
}
