"""Page templates are explicit contracts, independent of article translations."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from knut_vandrar_backend.models.enums import PageKey

PageLocaleCode = Literal["sv", "en", "cs"]


class PageContentFields(BaseModel):
    model_config = ConfigDict(extra="forbid")
    eyebrow: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=300)
    introduction: str = Field(min_length=1, max_length=3000)
    body_markdown: str = Field(min_length=1, max_length=100000)


class StandardPageContent(PageContentFields):
    type: Literal["standard"]


class AboutPageContent(PageContentFields):
    type: Literal["about"]
    portrait_alt: str = Field(min_length=1, max_length=500)
    caption: str = Field(max_length=1000)
    aside_title: str = Field(min_length=1, max_length=300)
    aside_text: str = Field(min_length=1, max_length=3000)
    cta_title: str = Field(min_length=1, max_length=300)
    cta_text: str = Field(min_length=1, max_length=3000)
    cta: str = Field(min_length=1, max_length=200)


PageContent = Annotated[AboutPageContent | StandardPageContent, Field(discriminator="type")]


class PageWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    page_key: PageKey
    locale: PageLocaleCode
    published: bool = False
    indexable: bool = False
    content: PageContent


class PageRead(PageWrite):
    id: UUID


class PageSummary(BaseModel):
    page_key: PageKey
    locale: PageLocaleCode
    indexable: bool
    available_locales: list[PageLocaleCode]


class PublicPage(PageSummary):
    content: PageContent
