import type { UnknownAction } from '@reduxjs/toolkit'

import { useContext } from 'react'
import { useTranslation } from 'react-i18next'

import type { AppThunk, RootState } from '../store'
import type { CodeObject, GameComponent, Togglable } from '../types'

import { useAppDispatch, useAppSelector, useInvalid } from '../hooks'
import { stepActiveContext } from '../hooks'
import PinIcon from '../images/icons/pin.svg?react'
import { massComponentToggle, setErrorMessage } from '../store'
import LocaleText from './localeText'

interface ComponentToggleProps<T> {
  selector: (state: RootState) => T[]
  toggleComponent: (code: string) => AppThunk | UnknownAction
  getLabelKey: (component: T) => string
  unsorted?: boolean | undefined
  /** If provided along with pinComponent, enabled components can be pinned. */
  getPinned?: ((component: T) => boolean) | undefined
  pinComponent?: ((code: string, pinned: boolean) => AppThunk | UnknownAction) | undefined
}

const ComponentToggle = (<T extends CodeObject & GameComponent & Togglable>({
  selector,
  toggleComponent,
  getLabelKey,
  unsorted = false,
  getPinned,
  pinComponent,
}: ComponentToggleProps<T>) => {
  const components = useAppSelector(selector)
  const stepActive = useContext(stepActiveContext)
  const invalid = useInvalid(stepActive)
  const dispatch = useAppDispatch()
  const { t, i18n } = useTranslation()

  const allEnabled =
    stepActive && components.every(component => component.enabled || component.locked)
  const sortedComponents = components.map(component => ({
    ...component,
    label: t(getLabelKey(component)),
    pinned: getPinned?.(component) ?? false,
  }))
  // Sort our components list by default (unless asked explicitly not to)
  if (!unsorted) {
    sortedComponents.sort((a, b) => a.label.localeCompare(b.label, i18n.resolvedLanguage))
  }

  return (
    <div className="component-toggle">
      {stepActive ? (
        <div className="controls">
          <button
            type="button"
            onClick={() => {
              dispatch(massComponentToggle(selector, !allEnabled, toggleComponent))
            }}
          >
            <LocaleText i18nKey={allEnabled ? 'label.disableAll' : 'label.enableAll'} />
          </button>
          {
            // Show reset button if any components are default disabled
            components.some(component => component.defaultDisabled && !component.locked) ? (
              <button
                type="button"
                disabled={components.every(
                  component => component.enabled === !component.defaultDisabled || component.locked,
                )}
                onClick={() => {
                  dispatch(
                    massComponentToggle(
                      selector,
                      component => !component.defaultDisabled,
                      toggleComponent,
                    ),
                  )
                }}
              >
                <LocaleText i18nKey="label.reset" />
              </button>
            ) : null
          }
        </div>
      ) : null}
      <div className="components">
        {sortedComponents.map(({ code, enabled, image, label, locked, pinned }) =>
          enabled || stepActive ? (
            <div
              key={code}
              className="component"
            >
              <label
                title={stepActive && locked ? t(locked) : undefined}
                onClick={locked ? () => dispatch(setErrorMessage(locked)) : undefined}
              >
                <input
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  disabled={stepActive ? locked !== false : true}
                  aria-invalid={invalid ? true : undefined}
                  aria-errormessage={invalid ? 'appError' : undefined}
                  onChange={() => dispatch(toggleComponent(code))}
                />
                <img
                  src={image}
                  alt="" // Not required as the input already has a label
                  aria-hidden="true"
                />
                <div className="name">{label}</div>
              </label>
              {
                // Only show the pin button on enabled components while the step is active
                pinComponent && getPinned && enabled && stepActive ? (
                  <button
                    type="button"
                    className="pin"
                    aria-pressed={pinned}
                    aria-label={t('label.pinToDraft', { name: label })}
                    title={t('label.pinToDraft', { name: label })}
                    onClick={() => dispatch(pinComponent(code, !pinned))}
                  >
                    <PinIcon aria-hidden="true" />
                  </button>
                ) : null
              }
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}) satisfies React.FC<ComponentToggleProps<CodeObject & GameComponent & Togglable>>

export default ComponentToggle
