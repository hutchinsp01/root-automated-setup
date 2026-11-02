import { useContext } from 'react'

import { selectedFactionContext } from '../hooks'
import LocaleText from './localeText'

interface ComponentCountProps {
  component: 'buildings' | 'tokens' | 'warriors'
}

const ComponentCount: React.FC<ComponentCountProps> = ({ component }) => {
  const selectedFaction = useContext(selectedFactionContext)
  if (!selectedFaction) return null

  const count =
    component === 'warriors'
      ? selectedFaction.pieces.warriors
      : (selectedFaction.pieces[component]?.count ?? 0)
  if (count <= 0) return null

  const image =
    component === 'warriors' ? selectedFaction.image : selectedFaction.pieces[component]?.image
  // Vagabonds can use either their character's pawn (from the Vagabond Pack) or the standard pawn
  const characterImage = component === 'warriors' ? selectedFaction.vagabond?.image : undefined
  return (
    <div className="count">
      <div className="images">
        {characterImage ? (
          <img
            src={characterImage}
            alt="" // Image is just decoration, so hide from screen readers
            aria-hidden="true"
          />
        ) : null}
        <img
          src={image}
          alt="" // Image is just decoration, so hide from screen readers
          aria-hidden="true"
        />
      </div>{' '}
      &#215;
      <LocaleText
        i18nKey={`component.${component}`}
        count={count}
      />
    </div>
  )
}

export default ComponentCount
