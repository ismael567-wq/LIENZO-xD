import { useMemo } from 'react';
import type { TemplateId } from '../types';
import { TEMPLATES } from '../lib/templates';
import { createBoard } from '../lib/templates';
import { BoardPreview } from './BoardPreview';

function TemplateCard({
  id,
  onSelect,
  disabled,
}: {
  id: TemplateId;
  onSelect: (id: TemplateId) => void;
  disabled?: boolean;
}) {
  const meta = TEMPLATES.find((template) => template.id === id);
  const board = useMemo(
    () => createBoard(id, meta?.name ?? 'Plantilla'),
    [id, meta?.name],
  );
  if (!meta) return null;
  return (
    <button
      type="button"
      className="template-card"
      onClick={() => onSelect(id)}
      disabled={disabled}
    >
      <div className="template-preview">
        <BoardPreview board={board} padding={22} />
      </div>
      <div className="template-info">
        <span className="template-tag">{meta.tag}</span>
        <strong>{meta.name}</strong>
        <p>{meta.description}</p>
      </div>
    </button>
  );
}

export function TemplatePicker({
  mode,
  onSelect,
  hideBlank = false,
}: {
  mode: 'new' | 'insert';
  onSelect: (id: TemplateId) => void;
  hideBlank?: boolean;
}) {
  const templates = TEMPLATES.filter(
    (template) => !(hideBlank && template.id === 'blank'),
  );
  return (
    <div className={`template-picker is-${mode}`}>
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          id={template.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
