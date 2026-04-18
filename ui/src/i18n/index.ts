// i18n helper hook

import { useState, useEffect } from 'react'
import { zhTW } from '../i18n/zh-TW'

export type Locale = 'zh-TW'

// Simple localStorage-based locale persistence
const LOCALE_KEY = 'open-alice-locale'

export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-TW'
  const stored = localStorage.getItem(LOCALE_KEY)
  if (stored === 'zh-TW') return 'zh-TW'
  return 'zh-TW' // Default to Traditional Chinese
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCALE_KEY, locale)
  window.dispatchEvent(new CustomEvent('locale-change', { detail: locale }))
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const [locale, setLocaleState] = useState<Locale>('zh-TW')

  useEffect(() => {
    const stored = getLocale()
    setLocaleState(stored)
  }, [])

  const updateLocale = (newLocale: Locale) => {
    setLocale(newLocale)
    setLocaleState(newLocale)
  }

  return [locale, updateLocale]
}

/** Translation hook - returns zhTW directly */
export function useTranslation() {
  return zhTW
}
