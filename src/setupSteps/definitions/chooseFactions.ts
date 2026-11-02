import type { SetupStepDefinition } from '..'

import { CAPTAIN_DEAL_COUNT, MAX_CORNER_SETUPS } from '../../constants'
import { countMatches, getEnabled } from '../../functions/filtering'
import { shuffleList, takeRandom } from '../../functions/random'
import {
  addToFactionPool,
  lockFaction,
  massComponentLock,
  massComponentToggle,
  resetFactionPool,
  selectCaptainArray,
  selectFactionArray,
  selectFactionCodes,
  selectVagabondArray,
  setCurrentIndex,
  setCurrentPlayerIndex,
  setErrorMessage,
  setLimitCaptains,
  setLimitVagabonds,
  setUseDraft,
  toggleCaptain,
  toggleVagabond,
} from '../../store'
import { type CaptainCode, type FactionCode, SetupStep, type VagabondCode } from '../../types'
import ChooseFactionsStep from '../components/chooseFactionsStep'

export const chooseFactions: SetupStepDefinition = {
  beforeStep(dispatch, getState) {
    const state = getState()
    const playerCount = state.setup.playerCount

    // Don't allow draft setup if we can't spare an extra faction
    if (state.flow.useDraft) {
      const factionCodes = selectFactionCodes(state)
      const noSpareFactions = playerCount >= factionCodes.size
      if (noSpareFactions) dispatch(setUseDraft(false))
    }

    // Disable the factions that are mutually exclusive with the selected hirelings
    // Also disable insurgent factions if we're only playing with 2 people and no bots or hirelings
    dispatch(
      massComponentLock(
        selectFactionArray,
        ({ code, militant }) => {
          // Disable insurgent factions if we're only playing with 2 people and no bots or hirelings
          if (
            playerCount < 3 &&
            !militant &&
            state.setup.hirelingCount < 1 &&
            !state.setup.includeBots
          ) {
            return 'error.tooFewPlayerInsurgent'
          }
          // Disable a faction if it was replaced by an equivalent hireling
          if (state.setup.excludedFactions.includes(code)) return 'error.hirelingSelected'
          return false
        },
        lockFaction,
      ),
    )

    // Set limitVagabonds based on whether we previously limited the vagabond selection
    dispatch(setLimitVagabonds(selectVagabondArray(state).some(vagabond => !vagabond.enabled)))

    // Set limitCaptains based on whether we previously limited the captain selection
    dispatch(setLimitCaptains(selectCaptainArray(state).some(captain => !captain.enabled)))

    return null
  },

  component: ChooseFactionsStep,

  afterStep(dispatch, getState) {
    const state = getState()
    const useDraft = state.flow.useDraft
    const playerCount = state.setup.playerCount

    // Clear the faction pool of any potential stale data from previous setups
    if (state.flow.factionPool.length > 0) dispatch(resetFactionPool())

    // Get our list of factions which are available for selection
    const enabledFactions = getEnabled(selectFactionArray(state))
    let vagabondPool: VagabondCode[] | undefined
    let captainPool: CaptainCode[] | undefined

    // Validate and set up the vagabond/captain pool for draft setup
    if (useDraft) {
      if (state.setup.limitVagabonds) {
        // To keep the previous steps clean, disable if no vagabonds were actually deselected
        if (selectVagabondArray(state).every(vagabond => vagabond.enabled)) {
          dispatch(setLimitVagabonds(false))
        }
      } else {
        // Make sure to enable all vagabonds if limitVagabonds is false to prevent confusion
        dispatch(massComponentToggle(selectVagabondArray, true, toggleVagabond))
      }
      vagabondPool = getEnabled(selectVagabondArray(getState())).map(({ code }) => code)

      // Get our vagabond faction count to validate our vagabondPool against
      const vagabondFactionCount = countMatches(
        enabledFactions,
        ({ dealVagabond }) => dealVagabond ?? false,
      )
      if (vagabondPool.length < vagabondFactionCount) {
        dispatch(setErrorMessage('error.tooFewVagabond'))
        return null
      }

      // Make sure to enable all captains if limitCaptains is false to prevent confusion
      if (state.setup.limitCaptains) {
        // To keep the previous steps clean, disable if no captains were actually deselected
        if (selectCaptainArray(state).every(captain => captain.enabled)) {
          dispatch(setLimitCaptains(false))
        }
      } else {
        // Make sure to enable all captains if limitCaptains is false to prevent confusion
        dispatch(massComponentToggle(selectCaptainArray, true, toggleCaptain))
      }
      captainPool = getEnabled(selectCaptainArray(getState())).map(({ code }) => code)

      // Get our knave faction count to validate our captainPool against
      const captainFactionCount = countMatches(
        enabledFactions,
        ({ dealCaptains }) => dealCaptains ?? false,
      )
      if (captainPool.length < captainFactionCount * CAPTAIN_DEAL_COUNT) {
        dispatch(setErrorMessage('error.tooFewCaptains'))
        return null
      }
    }

    // Set the appropriate number of factions for setup
    const factionCount = useDraft ? playerCount + 1 : playerCount

    // Check that there are enough factions available for setup
    const hasMilitantFaction = enabledFactions.some(({ militant }) => militant)
    if (!hasMilitantFaction || enabledFactions.length < factionCount) {
      // Set the correct error message
      dispatch(
        setErrorMessage(!hasMilitantFaction ? 'error.noMilitantFaction' : 'error.tooFewFaction'),
      )
      return null
    }

    // Pinned factions are guaranteed a place in the draft pool, so check that they all fit together
    const pinnedFactions = useDraft ? enabledFactions.filter(({ pinned }) => pinned) : []
    const pinnedCodes = new Set(pinnedFactions.map(({ code }) => code))
    if (pinnedFactions.length > factionCount) {
      dispatch(setErrorMessage('error.tooManyPinned'))
      return null
    }
    if (
      pinnedFactions.some(({ excludeFactions }) =>
        excludeFactions?.some(code => pinnedCodes.has(code)),
      )
    ) {
      dispatch(setErrorMessage('error.pinnedConflict'))
      return null
    }
    const hasPinnedMilitant = pinnedFactions.some(({ militant }) => militant)
    if (pinnedFactions.length === factionCount && !hasPinnedMilitant) {
      dispatch(setErrorMessage('error.pinnedNoMilitant'))
      return null
    }

    // Get our list of militant and insurgent factions which are available for random selection
    const workingFactionPool = enabledFactions.filter(
      ({ code, militant }) => militant && !pinnedCodes.has(code),
    )
    const insurgentFactions = enabledFactions.filter(
      ({ code, militant }) => !militant && !pinnedCodes.has(code),
    )

    const chosenFactions: typeof enabledFactions = []
    // Keep track of if we've already used a corner in standard setup
    let cornerSetupCount = 0
    const incompatibleFactions = new Set<FactionCode>()

    const chooseFaction = (faction: (typeof enabledFactions)[number]) => {
      chosenFactions.push(faction)
      if (!useDraft && faction.standardSetup.cornerSetup) cornerSetupCount++
      faction.excludeFactions?.forEach(code => incompatibleFactions.add(code))
    }

    // Randomly choose factions from the given pool until we have chosen targetCount factions
    const chooseRandomFactions = (pool: typeof enabledFactions, targetCount: number) => {
      while (chosenFactions.length < targetCount && pool.length > 0) {
        const candidateFaction = takeRandom(pool)

        if (
          // Make sure we don't include more than 4 corner clearing factions in standard setup
          (useDraft ||
            !candidateFaction.standardSetup.cornerSetup ||
            cornerSetupCount < MAX_CORNER_SETUPS) &&
          // Don't include any factions that are incompatible with ones already chosen
          !incompatibleFactions.has(candidateFaction.code)
        ) {
          chooseFaction(candidateFaction)
        }
      }
    }

    // Start with the pinned factions, then make sure we have at least one militant faction
    pinnedFactions.forEach(chooseFaction)
    if (!hasPinnedMilitant) chooseRandomFactions(workingFactionPool, chosenFactions.length + 1)
    // Add the insurgent factions to the mix
    workingFactionPool.push(...insurgentFactions)
    // Add enough factions to make the total pool equal factionCount
    chooseRandomFactions(workingFactionPool, factionCount)

    // Check if we were able to set up
    if (chosenFactions.length < factionCount) {
      // Show appropriate error message
      dispatch(
        setErrorMessage(
          cornerSetupCount >= MAX_CORNER_SETUPS
            ? 'error.tooManyCornerSetup'
            : 'error.tooFewFaction',
        ),
      )
      return null
    }

    // Draft setup requires the pool to lead with a militant faction. Shuffle the rest so that pinned
    // factions can't be told apart from randomly chosen ones.
    shuffleList(chosenFactions)
    const militantIndex = chosenFactions.findIndex(({ militant }) => militant)
    chosenFactions.unshift(...chosenFactions.splice(militantIndex, 1))
    chosenFactions.forEach(faction => {
      dispatch(addToFactionPool(faction, vagabondPool, captainPool))
    })

    dispatch(setCurrentPlayerIndex(null))
    dispatch(setCurrentIndex(null))
    return SetupStep.selectFaction
  },
}
