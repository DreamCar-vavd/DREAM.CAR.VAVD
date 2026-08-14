"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Car, Check, ClipboardCheck, Pencil, Plus, ShieldCheck, Trash2, User, X } from "lucide-react";
import type { Dictionary, GalleryProjectCopy } from "@/content/types";
import type { Locale } from "@/lib/i18n/config";
import { locales } from "@/lib/i18n/config";
import type { GalleryProjectEntry } from "@/content/galleryProjects";
import { DreamLogo } from "./DreamLogo";
import { GoldLink, GoldButton } from "./GoldButton";
import { WhatsAppIcon } from "./icons/SocialIcons";
import { whatsappUrl } from "@/lib/social";

const EDITABLE_PROJECT_IDS = new Set(["maserati-levante", "volvo-xc60-d5"]);

type EditState = Record<Locale, GalleryProjectCopy>;

const EDIT_LOCALE_LABEL: Record<Locale, string> = { uk: "UA", ru: "RU", en: "EN" };

export function GalleryProjectModal({
  dict,
  locale,
  project,
  onClose,
}: {
  dict: Dictionary;
  locale: Locale;
  project: GalleryProjectEntry;
  onClose: () => void;
}) {
  const router = useRouter();
  const copy = dict.gallery.projects[project.id];
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activeImage = project.images[activeIndex];

  const canEdit = process.env.NODE_ENV === "development" && EDITABLE_PROJECT_IDS.has(project.id);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditState | null>(null);
  const [editLocale, setEditLocale] = useState<Locale>(locale);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEditing() {
    setEditError(null);
    setIsLoadingEdit(true);
    try {
      const response = await fetch(`/api/gallery-projects/${project.id}`);
      if (!response.ok) throw new Error("load-failed");
      const body = (await response.json()) as { locales: EditState };
      setEditData(body.locales);
      setEditLocale(locale);
      setIsEditing(true);
    } catch {
      setEditError("Не вдалося завантажити дані для редагування.");
    } finally {
      setIsLoadingEdit(false);
    }
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditData(null);
    setEditError(null);
  }

  function updateField<K extends keyof GalleryProjectCopy>(field: K, value: GalleryProjectCopy[K]) {
    setEditData((state) => {
      if (!state) return state;
      return { ...state, [editLocale]: { ...state[editLocale], [field]: value } };
    });
  }

  function updateCompletedItem(index: number, value: string) {
    setEditData((state) => {
      if (!state) return state;
      const items = [...state[editLocale].completedItems];
      items[index] = value;
      return { ...state, [editLocale]: { ...state[editLocale], completedItems: items } };
    });
  }

  function addCompletedItem() {
    setEditData((state) => {
      if (!state) return state;
      const items = [...state[editLocale].completedItems, ""];
      return { ...state, [editLocale]: { ...state[editLocale], completedItems: items } };
    });
  }

  function removeCompletedItem(index: number) {
    setEditData((state) => {
      if (!state) return state;
      const items = state[editLocale].completedItems.filter((_, i) => i !== index);
      return { ...state, [editLocale]: { ...state[editLocale], completedItems: items } };
    });
  }

  async function saveEditing() {
    if (!editData) return;
    for (const loc of locales) {
      if (!editData[loc].title.trim()) {
        setEditLocale(loc);
        setEditError(`Назва автомобіля не може бути порожньою (${EDIT_LOCALE_LABEL[loc]}).`);
        return;
      }
    }
    setIsSaving(true);
    setEditError(null);
    try {
      const response = await fetch(`/api/gallery-projects/${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locales: editData }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "save-failed");
      }
      setIsEditing(false);
      setEditData(null);
      router.refresh();
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Не вдалося зберегти зміни.");
    } finally {
      setIsSaving(false);
    }
  }

  const editCopy = editData?.[editLocale];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className={`fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-4 transition-opacity duration-[250ms] ease-out motion-reduce:transition-none ${
        mounted ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-y-auto rounded-md border border-gold bg-background shadow-[0_0_40px_rgba(212,175,55,0.15)] transition-all duration-[250ms] ease-out motion-reduce:transition-none ${
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-[0.98] opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-border-gold/50 px-5 py-3 sm:px-6">
          <DreamLogo alt={dict.meta.siteName} wrapperClassName="inline-block aspect-[1413/800] h-9" />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={dict.gallery.lightboxClose}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-gold text-gold transition-colors duration-300 hover:bg-gold/10"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[3fr_2fr] lg:gap-8 lg:p-8">
          <div>
            <div
              className="relative w-full overflow-hidden rounded-sm border border-border-gold/50 bg-surface"
              style={{ aspectRatio: `${activeImage.width} / ${activeImage.height}` }}
            >
              <Image
                src={activeImage.src}
                alt={`${copy.title} — ${activeIndex + 1}`}
                fill
                sizes="(min-width: 1024px) 60vw, 90vw"
                className="object-contain"
                priority
              />
            </div>

            {project.images.length > 1 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {project.images.map((image, index) => (
                  <button
                    key={image.src}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`${copy.title} — ${index + 1}`}
                    aria-current={index === activeIndex}
                    className={`relative overflow-hidden rounded-sm border transition-colors duration-300 ${
                      index === activeIndex
                        ? "border-2 border-gold"
                        : "border-border-gold/40 hover:border-gold/70"
                    }`}
                    style={{ aspectRatio: "1 / 1" }}
                  >
                    <Image src={image.src} alt="" fill sizes="10vw" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isEditing ? (
            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-heading text-2xl font-bold text-gold sm:text-3xl">
                  {copy.title}
                  {copy.year ? `, ${copy.year}` : ""}
                </h2>
                {canEdit && (
                  <button
                    type="button"
                    onClick={startEditing}
                    disabled={isLoadingEdit}
                    className="flex shrink-0 items-center gap-1.5 rounded-sm border border-border-gold/60 px-3 py-1.5 text-xs font-semibold text-gold transition-colors duration-300 hover:bg-gold/10 disabled:opacity-50"
                  >
                    <Pencil size={14} aria-hidden="true" />
                    {isLoadingEdit ? "Завантаження…" : "Редагувати інформацію"}
                  </button>
                )}
              </div>
              <p className="mt-1 text-text">{copy.service}</p>

              <div className="mt-4 border-t border-border-gold/40 pt-4">
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                  <User size={18} aria-hidden="true" />
                  {dict.gallery.modal.clientRequestLabel}
                </h3>
                <p className="mt-2 text-sm text-muted">{copy.clientRequest}</p>
              </div>

              <div className="mt-4 border-t border-border-gold/40 pt-4">
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                  <ClipboardCheck size={18} aria-hidden="true" />
                  {dict.gallery.modal.checkedLabel}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {copy.completedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted">
                      <Check size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-t border-border-gold/40 pt-4">
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold tracking-wide text-gold">
                  <ShieldCheck size={18} aria-hidden="true" />
                  {dict.gallery.modal.resultLabel}
                </h3>
                <p className="mt-2 text-sm text-muted">{copy.result}</p>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <GoldLink
                  href={`/${locale}#contacts`}
                  variant="solid"
                  className="w-full whitespace-nowrap sm:w-auto"
                >
                  <Car size={16} aria-hidden="true" />
                  {dict.common.consultationCta}
                </GoldLink>
                <GoldLink
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  className="whatsapp-cta w-full whitespace-nowrap sm:w-auto"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  {dict.common.whatsappCta}
                </GoldLink>
              </div>
            </div>
          ) : (
            editCopy && (
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-heading text-lg font-bold text-gold">Редагування інформації</h2>
                  <div className="flex gap-1 rounded-sm border border-border-gold/50 p-0.5">
                    {locales.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setEditLocale(loc)}
                        className={`rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors duration-300 ${
                          loc === editLocale ? "bg-gold text-[#0a0a0a]" : "text-gold hover:bg-gold/10"
                        }`}
                      >
                        {EDIT_LOCALE_LABEL[loc]}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="mt-4 flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                  Назва автомобіля
                  <input
                    type="text"
                    value={editCopy.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="rounded-sm border border-border-gold/50 bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                  />
                </label>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                    Рік
                    <input
                      type="text"
                      value={editCopy.year}
                      onChange={(event) => updateField("year", event.target.value)}
                      className="rounded-sm border border-border-gold/50 bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                    Послуга
                    <input
                      type="text"
                      value={editCopy.service}
                      onChange={(event) => updateField("service", event.target.value)}
                      className="rounded-sm border border-border-gold/50 bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                    />
                  </label>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                  Запит клієнта
                  <textarea
                    value={editCopy.clientRequest}
                    onChange={(event) => updateField("clientRequest", event.target.value)}
                    rows={2}
                    className="rounded-sm border border-border-gold/50 bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                  />
                </label>

                <div className="mt-3 flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                  Що перевірили
                  <div className="flex flex-col gap-1.5">
                    {editCopy.completedItems.map((item, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={item}
                          onChange={(event) => updateCompletedItem(index, event.target.value)}
                          className="flex-1 rounded-sm border border-border-gold/50 bg-surface px-3 py-1.5 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                        />
                        <button
                          type="button"
                          aria-label="Видалити пункт"
                          onClick={() => removeCompletedItem(index)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-border-gold/50 text-gold hover:bg-gold/10"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addCompletedItem}
                    className="mt-1 flex w-fit items-center gap-1 text-xs font-semibold text-gold hover:text-gold-light"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Додати пункт
                  </button>
                </div>

                <label className="mt-3 flex flex-col gap-1 text-xs font-semibold tracking-wide text-gold">
                  Результат
                  <textarea
                    value={editCopy.result}
                    onChange={(event) => updateField("result", event.target.value)}
                    rows={2}
                    className="rounded-sm border border-border-gold/50 bg-surface px-3 py-2 text-sm font-normal text-text focus-visible:border-gold focus-visible:outline-none"
                  />
                </label>

                {editError && <p className="mt-3 text-sm text-gold-light">{editError}</p>}

                <div className="mt-4 flex gap-3">
                  <GoldButton
                    type="button"
                    variant="solid"
                    onClick={saveEditing}
                    disabled={isSaving}
                    className="disabled:opacity-50"
                  >
                    {isSaving ? "Збереження…" : "Зберегти"}
                  </GoldButton>
                  <GoldButton type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                    Скасувати
                  </GoldButton>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
