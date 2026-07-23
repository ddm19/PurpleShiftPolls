export type Locale = "es" | "en";

type Dict = Record<string, string>;

const es: Dict = {
  header_subtitle: "Encuesta de Playtest de la versión v26.07.14",
  admin_link: "[ ADMIN ]",
  loading_survey: "// cargando red de encuestas...",
  error_title: "✕ ERROR DE CONEXIÓN",
  error_subtitle: "// no se pudo conectar con el servidor central.",
  empty_questions_pre: "// no hay preguntas configuradas. visita",
  empty_questions_post: "para configurarlas.",
  question_counter: "PREGUNTA {current} / {total}",
  answer_placeholder: "introduce tu respuesta...",
  numeric_placeholder: "introduce un número...",
  skip: "Saltar →",
  transmit: "Transmitir →",
  confirm: "Confirmar →",
  question_image_alt: "Imagen de la pregunta",
  close_image: "Cerrar imagen",
  enlarged_image_alt: "Imagen ampliada",
  gallery_loading: "// obteniendo datos de niveles...",
  gallery_empty: "// aún no se han subido datos de niveles. visita /admin para cargarlos.",
  previous_level: "Nivel anterior",
  next_level: "Siguiente nivel",
  selected_counter: "SELECCIONADO // {current} DE {total}",
  vote_level: "▶ Votar por este Nivel",
  no_image: "sin imagen",
  thanks_heading: "Gracias por completar la encuesta",
  thanks_body:
    "¿Te gustaría saber más sobre Purple Shift? Anótate en nuestra lista de correo para recibir noticias y actualizaciones.",
  email_placeholder: "tu-correo@electronico.com",
  subscribe: "Suscribirme",
  sending: "Enviando...",
  no_thanks: "No, gracias",
  invalid_email: "Por favor, introduce un correo electrónico válido.",
  thanks_final: "Gracias por completar la encuesta.",
};

const en: Dict = {
  header_subtitle: "Playtest Survey v26.07.14",
  admin_link: "[ ADMIN ]",
  loading_survey: "// loading survey network...",
  error_title: "✕ CONNECTION ERROR",
  error_subtitle: "// could not connect to the central server.",
  empty_questions_pre: "// no questions configured yet. visit",
  empty_questions_post: "to configure them.",
  question_counter: "QUESTION {current} / {total}",
  answer_placeholder: "enter your answer...",
  numeric_placeholder: "enter a number...",
  skip: "Skip →",
  transmit: "Transmit →",
  confirm: "Confirm →",
  question_image_alt: "Question image",
  close_image: "Close image",
  enlarged_image_alt: "Enlarged image",
  gallery_loading: "// fetching level data...",
  gallery_empty: "// no level data uploaded yet. visit /admin to upload it.",
  previous_level: "Previous level",
  next_level: "Next level",
  selected_counter: "SELECTED // {current} OF {total}",
  vote_level: "▶ Vote for this Level",
  no_image: "no image",
  thanks_heading: "Thanks for completing the survey",
  thanks_body:
    "Want to know more about Purple Shift? Sign up for our mailing list to get news and updates.",
  email_placeholder: "your-email@example.com",
  subscribe: "Subscribe",
  sending: "Sending...",
  no_thanks: "No, thanks",
  invalid_email: "Please enter a valid email address.",
  thanks_final: "Thanks for completing the survey.",
};

const dictionaries: Record<Locale, Dict> = { es, en };

export function translate(
  locale: Locale,
  key: keyof typeof es,
  vars?: Record<string, string | number>,
): string {
  let str = dictionaries[locale][key] ?? dictionaries.es[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

export function getPrompt(
  q: { text_prompt_es: string; text_prompt_en: string },
  locale: Locale,
): string {
  if (locale === "en") return q.text_prompt_en || q.text_prompt_es;
  return q.text_prompt_es || q.text_prompt_en;
}

/** Resolves the multiple-choice options to show for a given locale, falling back
 * per-item to the other language when a translation is missing. */
export function getChoices(
  q: { choices_es?: string[] | null; choices_en?: string[] | null },
  locale: Locale,
): string[] {
  const esArr = q.choices_es ?? [];
  const enArr = q.choices_en ?? [];
  const len = Math.max(esArr.length, enArr.length);
  return Array.from({ length: len }, (_, i) =>
    locale === "en" ? enArr[i] || esArr[i] || "" : esArr[i] || enArr[i] || "",
  );
}

/** Pairs up choices_es/choices_en by index — used to aggregate responses that were
 * answered in either language under the same logical option. */
export function zipChoices(q: {
  choices_es?: string[] | null;
  choices_en?: string[] | null;
}): { es: string; en: string }[] {
  const esArr = q.choices_es ?? [];
  const enArr = q.choices_en ?? [];
  const len = Math.max(esArr.length, enArr.length);
  return Array.from({ length: len }, (_, i) => ({ es: esArr[i] ?? "", en: enArr[i] ?? "" }));
}
