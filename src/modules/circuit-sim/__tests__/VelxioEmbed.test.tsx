import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VelxioEmbed } from '../VelxioEmbed'
import { DEFAULT_VELXIO_IFRAME_ALLOW, DEFAULT_VELXIO_IFRAME_SANDBOX, type VelxioSource } from '../velxioConfig'

const source: VelxioSource = {
  mode: 'self-hosted',
  label: 'Self-hosted Velxio',
  url: 'http://localhost:3080/',
  healthcheckUrl: 'http://localhost:3080/',
  configured: true,
}

function renderEmbed(overrides: Partial<ComponentProps<typeof VelxioEmbed>> = {}) {
  return render(
    <VelxioEmbed
      source={source}
      status="ready"
      message="Velxio is reachable."
      reloadToken={0}
      sandbox={DEFAULT_VELXIO_IFRAME_SANDBOX}
      allow={DEFAULT_VELXIO_IFRAME_ALLOW}
      allowNewTab
      onRetry={vi.fn()}
      onReload={vi.fn()}
      {...overrides}
    />,
  )
}

describe('VelxioEmbed', () => {
  it('renders a sandboxed Velxio iframe with a loading state', async () => {
    renderEmbed()

    const iframe = screen.getByTitle('Velxio circuit simulator')
    expect(iframe).toHaveAttribute('src', source.url)
    expect(iframe).toHaveAttribute('sandbox', DEFAULT_VELXIO_IFRAME_SANDBOX)
    expect(iframe).toHaveAttribute('allow', DEFAULT_VELXIO_IFRAME_ALLOW)
    expect(iframe).toHaveAttribute('referrerPolicy', 'no-referrer')
    expect(screen.getByRole('status')).toHaveTextContent('Loading Self-hosted Velxio')

    fireEvent.load(iframe)
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })

  it('shows retry and new-tab actions when Velxio is unavailable', () => {
    const onRetry = vi.fn()
    renderEmbed({
      status: 'unavailable',
      message: 'Could not reach Velxio.',
      onRetry,
    })

    expect(screen.getByText('Velxio simulator is not available')).toBeInTheDocument()
    expect(screen.getByText(source.url)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeInTheDocument()
  })

  it('does not render a blank frame when the integration is disabled', () => {
    renderEmbed({
      source: null,
      status: 'disabled',
      message: 'Set VITE_VELXIO_URL.',
      allowNewTab: false,
    })

    expect(screen.getByText('Velxio simulator is not configured')).toBeInTheDocument()
    expect(screen.queryByTitle('Velxio circuit simulator')).not.toBeInTheDocument()
  })
})
