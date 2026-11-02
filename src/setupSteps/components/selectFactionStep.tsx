import { useContext } from 'react'

import type { SetupStepComponent } from '..'

import Button from '../../components/button'
import FactionInfo from '../../components/factionInfo'
import FactionSelect from '../../components/factionSelect'
import LocaleText from '../../components/localeText'
import Section from '../../components/section'
import { stepActiveContext, useAppDispatch, useAppSelector, usePlayerNumber } from '../../hooks'
import RerollIcon from '../../images/icons/reroll.svg?react'
import { undoStep } from '../../store'
import { SetupStep } from '../../types'
import { nextStep } from '../nextStep'

const SelectFactionStep: SetupStepComponent = ({ flowSlice }) => {
  const useDraft = useAppSelector(state => state.flow.useDraft)
  // Factions can only be re-rolled before anyone has picked one (i.e. straight after choosing them)
  const canReroll = useAppSelector(
    state => state.flow.pastSteps.at(-1)?.step === SetupStep.chooseFactions,
  )
  const stepActive = useContext(stepActiveContext)
  const playerNumber = usePlayerNumber(flowSlice)
  const dispatch = useAppDispatch()

  return (
    <Section
      subtitleKey="setupStep.selectFaction.subtitle"
      textKey="setupStep.selectFaction.body"
      translationOptions={{
        count: playerNumber,
        context: useDraft ? 'useDraft' : undefined,
      }}
    >
      <FactionSelect flowSlice={flowSlice} />
      {stepActive && canReroll ? (
        <Button
          Icon={RerollIcon}
          iconLeft
          onClick={() => {
            // Re-run the faction step with the same settings to generate a new faction pool
            dispatch(undoStep())
            dispatch(nextStep())
          }}
        >
          <LocaleText i18nKey="label.rerollFactions" />
        </Button>
      ) : null}
      <FactionInfo flowSlice={flowSlice} />
    </Section>
  )
}

export default SelectFactionStep
