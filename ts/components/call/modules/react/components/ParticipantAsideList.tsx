import * as React from 'react';
import { useParticipants, useSortedParticipants, useTracks } from '../hooks';
import { useFeatureContext } from '../context';
import { RoomEvent, Track } from '@cc-livekit/livekit-client';
import { TrackMutedIndicator } from './participant/TrackMutedIndicator';
import { useParticipantContextMenu } from '../hooks/useParticipantContextMenu';
import { ContextMenu } from '../../../../shared/ContextMenu';

interface IProps {
  open: boolean;
  onClose: () => void;
}

const RaiseHandList = () => {
  const features = useFeatureContext();
  const raiseHandList = features?.raiseHandList ?? [];
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  const { renderParticipantPlaceholder, nameFormatter, cancelHand } =
    features ?? {};

  const sortedRaiseHandList = React.useMemo(() => {
    const sorted = raiseHandList.sort((a, b) => {
      return a.ts - b.ts;
    });

    return isCollapsed ? sorted.slice(0, 5) : sorted;
  }, [raiseHandList, isCollapsed]);

  if (raiseHandList.length === 0) {
    return null;
  }

  return (
    <div className="lk-raise-hand-list">
      <div className="lk-raise-hand-list-header">
        <div className="lk-raise-hand-list-header-icon">
          <div className="call-icon raise-hand-icon"></div>
        </div>
        <span className="lk-raise-hand-list-header-text">
          Raise hand ({raiseHandList.length})
        </span>
      </div>
      <div className="lk-raise-hand-list-content">
        {sortedRaiseHandList.map((participant, index) => (
          <div key={index} className="lk-raise-hand-list-item">
            <div className="lk-raise-hand-list-item-info">
              <div className={`lk-raise-hand-list-item-avatar`}>
                {renderParticipantPlaceholder?.(participant as any, {
                  size: 28,
                })}
              </div>
              <div className="lk-raise-hand-list-item-info-name">
                <span className="lk-raise-hand-list-item-info-name-text">
                  {nameFormatter
                    ? nameFormatter(participant as any)
                    : participant.identity}
                </span>
              </div>
            </div>
            <div
              className="lk-raise-hand-list-item-lower"
              onClick={() => cancelHand?.([participant.identity])}
            >
              Lower
            </div>
          </div>
        ))}
        {raiseHandList.length > 5 && (
          <div
            className="lk-raise-hand-list-collapse-toggle"
            onClick={() => setIsCollapsed(prev => !prev)}
          >
            {isCollapsed ? (
              <div className="call-icon arrow-down-icon"></div>
            ) : (
              <div className="call-icon arrow-up-icon"></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const ParticipantAsideList = (props: IProps) => {
  const { open, onClose } = props;

  const [searchQuery, setSearchQuery] = React.useState('');
  const participantsSource = useParticipants();
  const participants = useSortedParticipants(participantsSource);
  const features = useFeatureContext();
  const { renderParticipantPlaceholder, nameFormatter } = features!;

  const filteredParticipants = React.useMemo(() => {
    return participants.filter(p =>
      (nameFormatter?.(p) ?? p.identity)
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    );
  }, [participants, searchQuery]);

  const [screenShareTrack] = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  );

  const { getContextMenuItems } = useParticipantContextMenu();

  if (!open) {
    return null;
  }

  return (
    <div className="lk-participant-aside-list">
      <div className="lk-participant-aside-list-header">
        <span className="lk-participant-aside-list-header-title">
          Attendees({participants.length})
        </span>
        <div
          className="lk-participant-aside-list-close-button"
          onClick={onClose}
        >
          <div className="call-icon call-close-icon"></div>
        </div>
      </div>

      <div className="lk-participant-aside-list-search">
        <input
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="lk-participant-aside-list-input"
        />
      </div>

      <div className="lk-participant-aside-list-list">
        {!searchQuery && <RaiseHandList />}
        {filteredParticipants.map((participant, index) => (
          <div key={index} className="lk-participant-aside-list-list-item">
            <ContextMenu
              menu={{ items: getContextMenuItems(participant) }}
              disabled={getContextMenuItems(participant).length === 0}
            >
              <div className="lk-participant-aside-list-list-item-info">
                <div className={`lk-participant-aside-list-list-item-avatar`}>
                  {renderParticipantPlaceholder?.(participant, { size: 28 })}
                </div>
                <div className="lk-participant-aside-list-list-item-info-name">
                  <span className="lk-participant-aside-list-list-item-info-name-text">
                    {nameFormatter
                      ? nameFormatter(participant)
                      : participant.identity}
                  </span>
                  <span className="lk-participant-aside-list-list-item-sharing">
                    {screenShareTrack?.participant?.identity ===
                    participant.identity
                      ? 'Sharing'
                      : ''}
                  </span>
                </div>
              </div>
            </ContextMenu>

            <div className="lk-participant-aside-list-list-item-status">
              <div className="lk-participant-aside-list-list-item-status-audio">
                <TrackMutedIndicator
                  trackRef={{
                    participant,
                    source: Track.Source.Microphone,
                  }}
                  show={'always'}
                  singleColor={true}
                ></TrackMutedIndicator>
              </div>
              <div className="lk-participant-aside-list-list-item-status-video">
                <TrackMutedIndicator
                  trackRef={{
                    participant,
                    source: Track.Source.Camera,
                  }}
                  show={'always'}
                  singleColor={true}
                ></TrackMutedIndicator>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
