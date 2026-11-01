import type {
  Board,
  BoardItem,
  ConnectorItem,
  FrameItem,
  ShapeItem,
  ShapeKind,
  StickyItem,
  TemplateId,
  TemplateMeta,
  TextItem,
} from '../types';
import { STICKY_COLORS } from './theme';
import { uid } from './geometry';

export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'blank',
    name: 'Lienzo en blanco',
    description: 'Una página infinita para empezar sin reglas.',
    tag: 'Libre',
  },
  {
    id: 'brainstorm',
    name: 'Lluvia de ideas',
    description: 'Un muro de notas para abrir el juego y agrupar temas.',
    tag: 'Ideación',
  },
  {
    id: 'retro',
    name: 'Retrospectiva',
    description: 'Qué funcionó, qué mejorar y próximos pasos.',
    tag: 'Equipos',
  },
  {
    id: 'kanban',
    name: 'Tablero Kanban',
    description: 'Organiza el trabajo en columnas y mueve tarjetas.',
    tag: 'Planificación',
  },
  {
    id: 'mindmap',
    name: 'Mapa mental',
    description: 'Una idea central y ramas conectadas para explorarla.',
    tag: 'Pensamiento',
  },
  {
    id: 'flow',
    name: 'Flujo de usuario',
    description: 'Recorre un proceso paso a paso con decisiones.',
    tag: 'Producto',
  },
  {
    id: 'journey',
    name: 'Viaje del cliente',
    description: 'Momentos, emociones y oportunidades en una línea.',
    tag: 'Investigación',
  },
  {
    id: 'week',
    name: 'Plan semanal',
    description: 'Lunes a domingo, con espacio para prioridades.',
    tag: 'Personal',
  },
  {
    id: 'welcome',
    name: 'Bienvenida',
    description: 'Un recorrido guiado por todo lo que puedes hacer.',
    tag: 'Lienzo',
  },
];

export const DEFAULT_BOARD_NAME: Record<TemplateId, string> = {
  blank: 'Lienzo sin título',
  welcome: 'Bienvenido a Lienzo',
  brainstorm: 'Lluvia de ideas',
  retro: 'Retrospectiva del equipo',
  kanban: 'Plan del sprint',
  mindmap: 'Mapa mental',
  flow: 'Flujo de usuario',
  journey: 'Viaje del cliente',
  week: 'Mi semana',
};

const now = () => Date.now();

interface BaseProps {
  x: number;
  y: number;
  w: number;
  h: number;
}

function base(props: BaseProps) {
  return { id: uid(9), updatedAt: now(), ...props };
}

function sticky(
  x: number,
  y: number,
  text: string,
  colorIndex = 0,
  size = 180,
  author = 'Equipo',
): StickyItem {
  const color = STICKY_COLORS[colorIndex % STICKY_COLORS.length];
  return {
    ...base({ x, y, w: size, h: size }),
    type: 'sticky',
    text,
    fill: color.value,
    textColor: color.text,
    fontSize: 16,
    author,
  };
}

function shape(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  kind: ShapeKind = 'rect',
  fill = '#FFFDF7',
  stroke = '#16211E',
): ShapeItem {
  return {
    ...base({ x, y, w, h }),
    type: 'shape',
    shape: kind,
    text,
    fill,
    stroke,
    strokeWidth: 1.5,
    radius: kind === 'rect' ? 16 : 0,
    fontSize: 17,
    textColor: '#16211E',
  };
}

function text(
  x: number,
  y: number,
  w: number,
  content: string,
  fontSize = 24,
  color = '#16211E',
  fontFamily: 'sans' | 'serif' = 'sans',
  fontWeight: 400 | 500 | 600 | 700 = 400,
): TextItem {
  return {
    ...base({ x, y, w, h: Math.round(fontSize * 1.4) }),
    type: 'text',
    text: content,
    fontSize,
    color,
    align: 'left',
    fontWeight,
    fontFamily,
  };
}

function frame(
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  fill = '#FBFAF4',
): FrameItem {
  return { ...base({ x, y, w, h }), type: 'frame', title, fill };
}

function connector(
  from: BoardItem,
  to: BoardItem,
  options: Partial<Pick<ConnectorItem, 'color' | 'strokeWidth' | 'dashed' | 'arrowEnd' | 'label'>> = {},
): ConnectorItem {
  return {
    id: uid(9),
    type: 'connector',
    from: { itemId: from.id, x: from.x + from.w / 2, y: from.y + from.h / 2 },
    to: { itemId: to.id, x: to.x + to.w / 2, y: to.y + to.h / 2 },
    color: options.color ?? '#5B655F',
    strokeWidth: options.strokeWidth ?? 1.6,
    dashed: options.dashed ?? false,
    arrowStart: false,
    arrowEnd: options.arrowEnd ?? true,
    label: options.label ?? '',
    updatedAt: now(),
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  };
}

function createWelcome(): BoardItem[] {
  const items: BoardItem[] = [];
  const title = text(80, 56, 980, 'Bienvenido a Lienzo', 78, '#16211E', 'serif');
  title.h = 96;
  const subtitle = text(
    84,
    160,
    780,
    'El espacio visual para pensar en equipo. Sin cuentas, sin nube y sin fricción: todo vive en tu dispositivo.',
    22,
    '#4E5A55',
  );
  subtitle.h = 70;
  items.push(title, subtitle);

  items.push(
    shape(84, 248, 188, 40, '100% local', 'rect', '#E9F5EF', '#BFDCC9'),
    shape(284, 248, 210, 40, 'Tiempo real en LAN', 'rect', '#FFF0E5', '#F0D3BC'),
    shape(506, 248, 172, 40, '3 plataformas', 'rect', '#F2ECFC', '#DCCFEF'),
  );

  const f1 = frame(80, 330, 760, 470, 'Primeros pasos', '#FBFAF4');
  items.push(f1);

  const steps = [
    ['1', 'Crea', 'Elige una nota, una forma o un texto en la barra lateral y haz clic en el lienzo.'],
    ['2', 'Conecta', 'Selecciona el conector y arrastra de un elemento a otro para unir ideas.'],
    ['3', 'Comparte', 'Abre Compartir y escanea el QR desde tu móvil. Todo se sincroniza en tu red.'],
  ] as const;
  steps.forEach(([number, heading, copy], index) => {
    const y = 390 + index * 132;
    const badge = shape(120, y, 44, 44, number, 'ellipse', '#0E5B4F', '#0E5B4F');
    badge.textColor = '#FFFDF7';
    badge.fontSize = 20;
    badge.strokeWidth = 0;
    items.push(
      badge,
      text(184, y - 6, 560, heading, 24, '#16211E', 'sans', 600),
      text(184, y + 28, 610, copy, 16, '#5B655F'),
    );
  });

  const f2 = frame(900, 330, 600, 470, 'Así se siente', '#FFF7EE');
  items.push(f2);
  items.push(
    sticky(936, 386, 'Una idea se convierte en un plan', 0, 170, 'Tú'),
    sticky(1122, 386, 'El equipo suma contexto', 3, 170, 'Equipo'),
    sticky(1029, 572, 'Todo queda a la vista', 4, 170, 'Tú'),
  );

  const note = shape(936, 692, 356, 72, 'Doble clic en cualquier nota para escribir.', 'rect', '#FFFDF7', '#E8D9C7');
  note.fontSize = 15;
  note.textColor = '#6B5A45';
  items.push(note);

  const footer = text(
    80,
    860,
    1420,
    'Atajos rápidos:  V seleccionar   ·   N nota   ·   T texto   ·   R forma   ·   C conector   ·   Espacio para moverte',
    14,
    '#7A837E',
  );
  footer.h = 30;
  items.push(footer);

  return items;
}

function createBrainstorm(): BoardItem[] {
  const items: BoardItem[] = [
    text(80, 64, 900, '¿Qué haría volar este proyecto?', 42, '#16211E', 'serif'),
    text(82, 124, 760, 'Escribe una idea por nota. Después agrupa, vota y conecta.', 18, '#5B655F'),
    frame(70, 190, 1120, 700, 'Ideas sin filtro', '#FBFAF4'),
  ];
  const prompts = [
    '¿Y si lo hacemos al revés?',
    'La versión 10× más simple',
    'Lo que nadie se atreve a decir',
    'Un detalle que enamore',
    'Quitar, no añadir',
    'El momento “ajá”',
    '¿Cómo lo explicaría un niño?',
    'La idea que da miedo',
    'Hazlo hoy en una hora',
  ];
  prompts.forEach((prompt, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    items.push(
      sticky(110 + col * 350, 260 + row * 200, prompt, index % STICKY_COLORS.length, 190),
    );
  });
  items.push(
    text(1240, 230, 300, 'Reglas del juego', 26, '#16211E', 'serif'),
    text(1240, 274, 300, '1. Cantidad antes que calidad.\n2. Construye sobre las ideas de otros.\n3. No hay malas ideas.', 16, '#5B655F'),
    shape(1240, 440, 280, 54, '+ Añade una idea', 'rect', '#0E5B4F', '#0E5B4F'),
  );
  const addShape = items[items.length - 1] as ShapeItem;
  addShape.textColor = '#FFFDF7';
  return items;
}

function createRetro(): BoardItem[] {
  const items: BoardItem[] = [
    text(80, 56, 800, 'Retrospectiva del equipo', 44, '#16211E', 'serif'),
    text(82, 118, 700, 'Un espacio seguro para mirar atrás y decidir el siguiente paso.', 17, '#5B655F'),
  ];
  const columns = [
    { title: 'Nos funcionó', color: '#E9F5EF', stickyColor: 3, notes: ['La daily de 10 minutos', 'Pair programming', 'Celebrar los pequeños avances'] },
    { title: 'Podemos mejorar', color: '#FFF0E5', stickyColor: 1, notes: ['Demasiados hilos abiertos', 'Faltó contexto en el handoff', 'Las revisiones llegan tarde'] },
    { title: 'Próximos pasos', color: '#F2ECFC', stickyColor: 5, notes: ['Un dueño por iniciativa', 'Demo cada viernes', 'Documentar decisiones'] },
  ];
  columns.forEach((column, index) => {
    const x = 80 + index * 440;
    items.push(frame(x, 190, 400, 620, column.title, column.color));
    column.notes.forEach((note, noteIndex) => {
      items.push(sticky(x + 30, 260 + noteIndex * 170, note, column.stickyColor, 150));
    });
    items.push(shape(x + 30, 720, 340, 50, '+ Añadir tarjeta', 'rect', '#FFFDF7', '#D8D2C2'));
  });
  items.push(
    text(80, 860, 1300, 'Acuerdos: máximo 3 acciones por retrospectiva, con dueño y fecha.', 15, '#7A837E'),
  );
  return items;
}

function createKanban(): BoardItem[] {
  const items: BoardItem[] = [
    text(60, 48, 700, 'Plan del sprint', 44, '#16211E', 'serif'),
    text(62, 108, 700, 'Arrastra las tarjetas entre columnas. Una cosa a la vez.', 17, '#5B655F'),
  ];
  const columns = ['Por hacer', 'En curso', 'En revisión', 'Hecho'];
  const colors = ['#F4F1E8', '#FFF0E5', '#E8EEFB', '#E9F5EF'];
  const cards = [
    ['Investigar competencia', 'Definir métricas', 'Entrevistar a 5 usuarios'],
    ['Prototipo del onboarding', 'Revisar arquitectura'],
    ['Copy de la landing'],
    ['Kickoff del sprint', 'Setup del entorno'],
  ];
  columns.forEach((column, index) => {
    const x = 60 + index * 360;
    items.push(frame(x, 180, 330, 620, column, colors[index]));
    items.push(shape(x + 24, 226, 280, 34, `${cards[index].length} tareas`, 'rect', '#FFFFFF', '#E8E2D2'));
    cards[index].forEach((card, cardIndex) => {
      const note = sticky(
        x + 24,
        282 + cardIndex * 120,
        card,
        [0, 1, 4, 3][index],
        120,
      );
      note.w = 282;
      note.h = 96;
      note.fontSize = 15;
      items.push(note);
    });
  });
  return items;
}

function createMindmap(): BoardItem[] {
  const items: BoardItem[] = [];
  const center = shape(660, 380, 300, 150, 'Lanzamiento del producto', 'ellipse', '#0E5B4F', '#0E5B4F');
  center.textColor = '#FFFDF7';
  center.fontSize = 22;
  items.push(center);
  const branches = [
    { x: 180, y: 150, text: 'Audiencia', fill: '#FFE58A' },
    { x: 1120, y: 140, text: 'Propuesta de valor', fill: '#BFE8D4' },
    { x: 140, y: 560, text: 'Canales', fill: '#B8DDF8' },
    { x: 1140, y: 570, text: 'Métricas', fill: '#FFC9A3' },
    { x: 610, y: 90, text: 'Mensaje', fill: '#D9C8F5' },
    { x: 640, y: 720, text: 'Primeros 100 usuarios', fill: '#FFB7C5' },
  ];
  branches.forEach((branch) => {
    const node = shape(branch.x, branch.y, 280, 90, branch.text, 'rect', branch.fill, '#16211E');
    items.push(node);
    items.push(connector(center, node, { color: '#7A837E' }));
  });
  items.push(text(80, 830, 520, 'Añade una rama con el conector (C).', 15, '#7A837E'));
  return items;
}

function createFlow(): BoardItem[] {
  const items: BoardItem[] = [
    text(80, 48, 800, 'Flujo de usuario: primera compra', 42, '#16211E', 'serif'),
    text(82, 108, 820, 'Del primer clic a la confirmación, sin zonas grises.', 17, '#5B655F'),
  ];
  const nodes = [
    shape(80, 240, 210, 110, 'Descubre la marca', 'rect', '#FFFDF7'),
    shape(380, 240, 210, 110, 'Explora el catálogo', 'rect', '#FFFDF7'),
    shape(680, 240, 210, 110, 'Elige un producto', 'rect', '#FFFDF7'),
    shape(980, 220, 240, 150, '¿Tiene dudas?', 'diamond', '#FFF0E5'),
    shape(1320, 240, 210, 110, 'Paga', 'rect', '#E9F5EF'),
    shape(980, 520, 240, 120, 'Chat de ayuda', 'rect', '#FFFDF7'),
    shape(1320, 520, 210, 110, 'Pedido confirmado', 'rect', '#0E5B4F', '#0E5B4F'),
  ];
  const confirmed = nodes[6] as ShapeItem;
  confirmed.textColor = '#FFFDF7';
  items.push(...nodes);
  items.push(
    connector(nodes[0], nodes[1]),
    connector(nodes[1], nodes[2]),
    connector(nodes[2], nodes[3]),
    connector(nodes[3], nodes[4], { label: 'No' }),
    connector(nodes[3], nodes[5], { label: 'Sí', dashed: true }),
    connector(nodes[5], nodes[4], { dashed: true }),
    connector(nodes[4], nodes[6]),
  );
  items.push(
    text(80, 720, 700, 'Oportunidad: reducir la duda entre elegir y pagar.', 18, '#B03A5B', 'sans', 500),
  );
  return items;
}

function createJourney(): BoardItem[] {
  const items: BoardItem[] = [
    text(70, 42, 900, 'Viaje del cliente', 44, '#16211E', 'serif'),
    text(72, 102, 780, 'Cómo se siente una persona en cada momento de la experiencia.', 17, '#5B655F'),
  ];
  const stages = [
    ['Descubre', 'Ve un anuncio de un amigo', 0],
    ['Investiga', 'Compara opciones y lee reseñas', 4],
    ['Prueba', 'Crea una cuenta y explora', 3],
    ['Compra', 'Elige plan y paga', 1],
    ['Recomienda', 'Comparte con su equipo', 5],
  ] as const;
  stages.forEach(([stage, note, color], index) => {
    const x = 70 + index * 300;
    items.push(
      frame(x, 180, 270, 560, stage, index % 2 === 0 ? '#FBFAF4' : '#FFF7EE'),
      sticky(x + 28, 250, note, color, 130),
      shape(x + 28, 620, 214, 44, ['😕', '🤔', '🙂', '😍', '🤩'][index], 'rect', '#FFFFFF', '#E8E2D2'),
    );
  });
  items.push(text(70, 790, 1400, 'Oportunidad: el momento de prueba concentra la mayor fricción.', 17, '#B03A5B', 'sans', 500));
  return items;
}

function createWeek(): BoardItem[] {
  const items: BoardItem[] = [
    text(60, 42, 700, 'Mi semana', 44, '#16211E', 'serif'),
    text(62, 102, 620, 'Menos ruido, más intención. Elige tres prioridades.', 17, '#5B655F'),
  ];
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  days.forEach((day, index) => {
    const x = 60 + index * 200;
    items.push(frame(x, 190, 180, 540, day, index > 4 ? '#FFF7EE' : '#FBFAF4'));
    if (index < 3) {
      items.push(sticky(x + 18, 250 + index * 50, ['Prioridad 1', 'Prioridad 2', 'Prioridad 3'][index], index, 144));
    }
  });
  items.push(
    shape(60, 760, 1380, 70, 'Intención de la semana: terminar una cosa importante, no diez a medias.', 'rect', '#E9F5EF', '#BFDCC9'),
  );
  return items;
}

export function createBoard(
  template: TemplateId = 'blank',
  name = DEFAULT_BOARD_NAME[template],
): Board {
  const timestamp = now();
  let items: BoardItem[] = [];
  switch (template) {
    case 'welcome':
      items = createWelcome();
      break;
    case 'brainstorm':
      items = createBrainstorm();
      break;
    case 'retro':
      items = createRetro();
      break;
    case 'kanban':
      items = createKanban();
      break;
    case 'mindmap':
      items = createMindmap();
      break;
    case 'flow':
      items = createFlow();
      break;
    case 'journey':
      items = createJourney();
      break;
    case 'week':
      items = createWeek();
      break;
    default:
      items = [];
  }
  return {
    id: uid(12),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    items,
    comments: [],
    background: template === 'blank' ? 'dots' : 'dots',
  };
}

export function createWelcomeBoard(): Board {
  return createBoard('welcome', 'Bienvenido a Lienzo');
}

export function templateItems(template: TemplateId): BoardItem[] {
  return createBoard(template).items;
}
