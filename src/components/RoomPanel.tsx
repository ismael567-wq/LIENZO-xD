import { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Hand,
  MessageCircle,
  Send,
  ThumbsUp,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { currentBoardOf, useLienzo } from '../store/boardStore';
import { initials } from './Logo';

interface RoomPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RoomPanel({ open, onClose }: RoomPanelProps) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const board = useLienzo((state) => currentBoardOf(state));
  const collab = useLienzo((state) => state.collab);
  const selected = useLienzo((state) => state.selected);
  const sendChat = useLienzo((state) => state.sendChat);
  const sendReaction = useLienzo((state) => state.sendReaction);
  const setRole = useLienzo((state) => state.setRole);
  const followPeer = useLienzo((state) => state.followPeer);
  const bringAllPeers = useLienzo((state) => state.bringAllPeers);
  const addVote = useLienzo((state) => state.addVote);
  const clearVotes = useLienzo((state) => state.clearVotes);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [collab.chat.length, open]);

  if (!open) return null;

  const votable = (board?.items ?? []).filter(
    (item) =>
      (selected.length === 0 || selected.includes(item.id)) &&
      item.type !== 'connector' &&
      (selected.length > 0 || (item as { votes?: string[] }).votes?.length),
  );

  return (
    <aside className="room-panel" aria-label="Sala de colaboración">
      <header>
        <span>
          <Users size={15} /> Sala
          <em className={`room-status is-${collab.status}`}>{collab.status}</em>
        </span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar sala">
          <X size={15} />
        </button>
      </header>

      <section className="room-section">
        <div className="room-roles" role="group" aria-label="Rol en la sala">
          <button
            type="button"
            className={collab.role === 'editor' ? 'is-active' : ''}
            onClick={() => setRole('editor')}
          >
            <Hand size={13} /> Editar
          </button>
          <button
            type="button"
            className={collab.role === 'viewer' ? 'is-active' : ''}
            onClick={() => setRole('viewer')}
          >
            <Eye size={13} /> Leer
          </button>
          <button type="button" onClick={bringAllPeers} title="Compartir mi vista con la sala">
            <UserCheck size={13} /> Traer a todos
          </button>
        </div>
        {collab.role === 'viewer' ? (
          <p className="room-hint">Modo lector: no se envían cambios al servidor.</p>
        ) : null}
      </section>

      <section className="room-section room-peers">
        <h4>Compañeros · {collab.peers.length}</h4>
        {collab.peers.length === 0 ? (
          <p className="room-empty">Comparte la sala para ver a otras personas aquí.</p>
        ) : null}
        {collab.peers.map((peer) => (
          <div key={peer.id} className={`room-peer ${collab.followId === peer.id ? 'is-followed' : ''}`}>
            <span className="peer-avatar" style={{ background: peer.color }}>
              {initials(peer.name)}
            </span>
            <span className="peer-name">{peer.name}</span>
            <button
              type="button"
              className={`peer-follow ${collab.followId === peer.id ? 'is-active' : ''}`}
              onClick={() => followPeer(collab.followId === peer.id ? null : peer.id)}
              title={collab.followId === peer.id ? 'Dejar de seguir' : 'Seguir cámara'}
            >
              {collab.followId === peer.id ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
        ))}
      </section>

      <section className="room-section room-votes">
        <h4>Votación por puntos</h4>
        {votable.length === 0 ? (
          <p className="room-empty">
            Selecciona objetos en el lienzo para votarlos, o vota los que ya tienen puntos.
          </p>
        ) : null}
        {votable.map((item) => {
          const votes = (item as { votes?: string[] }).votes ?? [];
          const label =
            item.type === 'sticky' || item.type === 'text' || item.type === 'shape'
              ? item.text.slice(0, 44) || 'Sin texto'
              : item.type === 'frame'
                ? item.title
                : item.type;
          return (
            <div key={item.id} className="vote-row">
              <span className="vote-label">{label}</span>
              <span className="vote-count">{votes.length}</span>
              <button type="button" className="icon-btn" onClick={() => addVote(item.id)} title="Votar">
                <ThumbsUp size={13} />
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => clearVotes(item.id)}
                title="Limpiar votos"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </section>

      <section className="room-section room-reactions">
        {['👏', '🎉', '❤️', '💡'].map((emoji) => (
          <button key={emoji} type="button" onClick={() => sendReaction(emoji)}>
            {emoji}
          </button>
        ))}
      </section>

      <section className="room-chat">
        <div className="room-chat-log" ref={scrollRef}>
          {collab.chat.length === 0 ? (
            <p className="room-empty">
              <MessageCircle size={13} /> Sin mensajes todavía.
            </p>
          ) : null}
          {collab.chat.map((message) => (
            <div
              key={message.id}
              className={`chat-message ${message.authorId === collab.selfId ? 'is-self' : ''}`}
            >
              <span className="chat-author">{message.author}</span>
              <p>{message.text}</p>
              <em>
                {new Date(message.at).toLocaleTimeString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </em>
            </div>
          ))}
        </div>
        <form
          className="room-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!text.trim()) return;
            sendChat(text);
            setText('');
          }}
        >
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Escribe a la sala…"
            aria-label="Mensaje para la sala"
            maxLength={800}
          />
          <button type="submit" className="icon-btn" disabled={!text.trim()} aria-label="Enviar">
            <Send size={14} />
          </button>
        </form>
      </section>
    </aside>
  );
}
