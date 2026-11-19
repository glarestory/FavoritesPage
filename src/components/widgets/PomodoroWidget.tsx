import { useCallback, useEffect, useRef, useState } from 'react'
import type { PomodoroSettings } from '../../types'
import { FOCUS_PRESETS, formatTimerSeconds } from '../../lib/widgets.mjs'
import {
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SkipForwardIcon,
  TimerIcon,
  Volume2Icon,
  VolumeXIcon,
} from '../Icons'

interface PomodoroWidgetProps {
  settings: PomodoroSettings
  onChangeFocusMinutes: (minutes: number) => void
  onCompleteFocusSession: () => void
  onTimerTitleChange: (titlePrefix: string | null) => void
  onNotify: (message: string) => void
}

type TimerPhase = 'focus' | 'break'

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const playTone = (frequency: number, startOffset: number, duration: number) => {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, now + startOffset)
      gain.gain.setValueAtTime(0.001, now + startOffset)
      gain.gain.exponentialRampToValueAtTime(0.12, now + startOffset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(now + startOffset)
      oscillator.stop(now + startOffset + duration + 0.02)
    }

    playTone(587.33, 0, 0.24) // D5
    playTone(880, 0.18, 0.36) // A5
    window.setTimeout(() => void ctx.close(), 900)
  } catch {
    // 오디오 정책으로 재생이 차단된 경우 조용히 무시합니다.
  }
}

export function PomodoroWidget({
  settings,
  onChangeFocusMinutes,
  onCompleteFocusSession,
  onTimerTitleChange,
  onNotify,
}: PomodoroWidgetProps) {
  const [phase, setPhase] = useState<TimerPhase>('focus')
  const [running, setRunning] = useState(false)
  const [muted, setMuted] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(settings.focusMinutes * 60)
  const [liveStatus, setLiveStatus] = useState('')
  const endTimeRef = useRef<number | null>(null)

  const totalSeconds =
    phase === 'focus' ? settings.focusMinutes * 60 : settings.breakMinutes * 60

  // 정지 상태에서 집중 시간이 변경되면 남은 시간도 즉시 맞춥니다.
  useEffect(() => {
    if (!running && phase === 'focus') {
      setRemainingSeconds(settings.focusMinutes * 60)
    }
  }, [settings.focusMinutes, running, phase])

  const finishCurrentPhase = useCallback(
    (completedNaturally: boolean) => {
      setRunning(false)
      endTimeRef.current = null

      if (phase === 'focus') {
        if (completedNaturally) {
          onCompleteFocusSession()
          if (!muted) playChime()
          const message = '집중 시간이 끝났습니다! 잠깐 휴식해 보세요.'
          setLiveStatus(message)
          onNotify(message)
        }
        setPhase('break')
        setRemainingSeconds(settings.breakMinutes * 60)
      } else {
        if (completedNaturally) {
          if (!muted) playChime()
          const message = '휴식이 끝났습니다! 다시 집중해 볼까요?'
          setLiveStatus(message)
          onNotify(message)
        }
        setPhase('focus')
        setRemainingSeconds(settings.focusMinutes * 60)
      }
    },
    [
      phase,
      muted,
      settings.breakMinutes,
      settings.focusMinutes,
      onCompleteFocusSession,
      onNotify,
    ],
  )

  useEffect(() => {
    if (!running) {
      onTimerTitleChange(null)
      return
    }

    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + remainingSeconds * 1000
    }

    const tick = () => {
      if (endTimeRef.current === null) return
      const nextRemaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      )
      setRemainingSeconds(nextRemaining)
      if (nextRemaining <= 0) {
        finishCurrentPhase(true)
      }
    }

    tick()
    const timer = window.setInterval(tick, 500)
    return () => window.clearInterval(timer)
  }, [running, finishCurrentPhase, onTimerTitleChange])

  useEffect(() => {
    if (!running) return
    const label = phase === 'focus' ? '집중' : '휴식'
    onTimerTitleChange(`${formatTimerSeconds(remainingSeconds)} ${label}`)
  }, [running, remainingSeconds, phase, onTimerTitleChange])

  useEffect(() => {
    return () => onTimerTitleChange(null)
  }, [onTimerTitleChange])

  const handleToggleRun = () => {
    if (running) {
      setRunning(false)
      endTimeRef.current = null
      return
    }
    const startFrom = remainingSeconds > 0 ? remainingSeconds : totalSeconds
    setRemainingSeconds(startFrom)
    endTimeRef.current = Date.now() + startFrom * 1000
    setLiveStatus('')
    setRunning(true)
  }

  const handleReset = () => {
    setRunning(false)
    endTimeRef.current = null
    setRemainingSeconds(totalSeconds)
    setLiveStatus('')
  }

  const handleSwitchPhase = (nextPhase: TimerPhase) => {
    if (nextPhase === phase) return
    setRunning(false)
    endTimeRef.current = null
    setPhase(nextPhase)
    setRemainingSeconds(
      nextPhase === 'focus' ? settings.focusMinutes * 60 : settings.breakMinutes * 60,
    )
    setLiveStatus('')
  }

  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds)

  return (
    <section className="widget-card" aria-labelledby="widget-pomodoro-title">
      <div className="widget-head">
        <h2 id="widget-pomodoro-title" className="widget-title">
          <TimerIcon size={15} />
          <span>포모도로</span>
        </h2>
        <div className="widget-head-actions">
          <span className="pomodoro-sessions" title="완료한 집중 세션">
            완료 {settings.completedSessions}회
          </span>
          <button
            type="button"
            className="widget-icon-button"
            onClick={() => setMuted((current) => !current)}
            aria-pressed={muted}
            aria-label={muted ? '타이머 알림음 켜기' : '타이머 알림음 끄기'}
            title={muted ? '알림음 꺼짐' : '알림음 켜짐'}
          >
            {muted ? <VolumeXIcon size={14} /> : <Volume2Icon size={14} />}
          </button>
        </div>
      </div>

      <div className="pomodoro-phases" role="group" aria-label="타이머 단계 선택">
        <button
          type="button"
          className={`pomodoro-phase-btn ${phase === 'focus' ? 'is-active' : ''}`}
          aria-pressed={phase === 'focus'}
          onClick={() => handleSwitchPhase('focus')}
        >
          집중 {settings.focusMinutes}분
        </button>
        <button
          type="button"
          className={`pomodoro-phase-btn ${phase === 'break' ? 'is-active' : ''}`}
          aria-pressed={phase === 'break'}
          onClick={() => handleSwitchPhase('break')}
        >
          휴식 {settings.breakMinutes}분
        </button>
      </div>

      <div className="pomodoro-clock" aria-live="off">
        {formatTimerSeconds(remainingSeconds)}
      </div>

      <progress
        className={`pomodoro-progress ${phase === 'break' ? 'is-break' : ''}`}
        value={elapsedSeconds}
        max={totalSeconds}
        aria-label={phase === 'focus' ? '집중 타이머 진행률' : '휴식 타이머 진행률'}
      />

      <div className="pomodoro-controls">
        <button
          type="button"
          className="button button--primary button--compact pomodoro-primary-btn"
          onClick={handleToggleRun}
        >
          {running ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
          <span>{running ? '일시정지' : '시작'}</span>
        </button>
        <button
          type="button"
          className="widget-icon-button"
          onClick={handleReset}
          aria-label="타이머 초기화"
          title="초기화"
        >
          <RotateCcwIcon size={14} />
        </button>
        <button
          type="button"
          className="widget-icon-button"
          onClick={() => finishCurrentPhase(false)}
          aria-label="다음 단계로 건너뛰기"
          title="다음 단계로 전환"
        >
          <SkipForwardIcon size={14} />
        </button>
      </div>

      <div className="pomodoro-presets" role="group" aria-label="집중 시간 프리셋">
        {FOCUS_PRESETS.map((minutes) => {
          const isSelected = settings.focusMinutes === minutes
          return (
            <button
              key={minutes}
              type="button"
              className={`widget-chip-button ${isSelected ? 'is-primary' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onChangeFocusMinutes(minutes)}
            >
              {minutes}분
            </button>
          )
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {liveStatus}
      </p>
    </section>
  )
}
