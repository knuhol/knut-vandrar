"""OpenAI Responses API adapter for structured hike translations."""

import json
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from knut_vandrar_backend.models.translation import TranslationGlossaryEntry


@dataclass(frozen=True)
class TranslationResult:
    fields: dict[str, str | None]
    model: str
    input_tokens: int | None
    output_tokens: int | None


def translate_hike(
    *,
    api_key: str,
    model: str,
    target_locale: str,
    instructions: str,
    glossary_entries: list[TranslationGlossaryEntry],
    source_fields: dict[str, str | None],
) -> TranslationResult:
    glossary = [
        {
            "source_term": entry.source_term,
            "target_term": entry.target_term,
            "context": entry.context,
            "do_not_translate": entry.do_not_translate,
        }
        for entry in glossary_entries
    ]
    developer_instructions = "\n\n".join(
        (
            instructions,
            f"Translate English content into locale {target_locale}.",
            "Translate prose naturally. Preserve Markdown structure, URLs, inline code, and proper names unless the glossary directs otherwise.",
            "Return every requested field. Preserve null fields as null; do not invent text.",
            f"Glossary: {json.dumps(glossary, ensure_ascii=False)}",
        )
    )
    schema = {
        "type": "object",
        "properties": {name: {"type": ["string", "null"]} for name in source_fields},
        "required": list(source_fields),
        "additionalProperties": False,
    }
    body = {
        "model": model,
        "input": [
            {"role": "developer", "content": developer_instructions},
            {
                "role": "user",
                "content": json.dumps(source_fields, ensure_ascii=False),
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "hike_translation",
                "strict": True,
                "schema": schema,
            }
        },
    }
    request = Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=90) as response:
            response_data = json.load(response)
    except HTTPError as exc:
        error_code = "unknown_error"
        try:
            error_body = json.loads(exc.read())
            if isinstance(error_body, dict) and isinstance(error_body.get("error"), dict):
                error_code = str(error_body["error"].get("code") or "unknown_error")
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
        raise RuntimeError(f"OpenAI API returned HTTP {exc.code} ({error_code})") from exc
    except (TimeoutError, URLError) as exc:
        raise RuntimeError("Could not reach the OpenAI API") from exc
    except json.JSONDecodeError as exc:
        raise RuntimeError("OpenAI API returned invalid JSON") from exc

    output_text = _response_text(response_data)
    try:
        translated = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("OpenAI returned invalid structured translation data") from exc
    if set(translated) != set(source_fields) or any(
        value is not None and not isinstance(value, str) for value in translated.values()
    ):
        raise RuntimeError("OpenAI translation did not match the requested fields")
    usage = response_data.get("usage", {})
    return TranslationResult(
        fields=translated,
        model=str(response_data.get("model", model)),
        input_tokens=_optional_int(usage.get("input_tokens")),
        output_tokens=_optional_int(usage.get("output_tokens")),
    )


def _response_text(response_data: dict[str, Any]) -> str:
    chunks = [
        part["text"]
        for item in response_data.get("output", [])
        if item.get("type") == "message"
        for part in item.get("content", [])
        if part.get("type") == "output_text" and isinstance(part.get("text"), str)
    ]
    if not chunks:
        raise RuntimeError("OpenAI response did not contain translation text")
    return "".join(chunks)


def _optional_int(value: object) -> int | None:
    return value if isinstance(value, int) else None
