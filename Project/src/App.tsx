import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import { useEffect, useState } from 'react'
import EventMarkers from './EventMarkers'
import SubscriptionPanel from './SubscriptionPanel'
import { MarkerData } from './types'

const barcelonaCenter: [number, number] = [41.3851, 2.1734]
const busRoute: [number, number][] = [
    [41.381, 2.168],
    [41.383, 2.170],
    [41.386, 2.173],
    [41.389, 2.175],
    [41.391, 2.178],
]

const parseHour = (hour: string) => {
    const [h, m] = hour.split(':').map(Number)
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : Infinity
}

const getBearing = (start: [number, number], end: [number, number]) => {
    const [lat1, lon1] = start.map((value) => (value * Math.PI) / 180)
    const [lat2, lon2] = end.map((value) => (value * Math.PI) / 180)
    const dLon = lon2 - lon1
    const y = Math.sin(dLon) * Math.cos(lat2)
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

const createArrowIcon = (rotation: number) =>
    new L.DivIcon({
        className: 'subscription-arrow-icon',
        html: `<div style="transform: rotate(${rotation}deg);">➤</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    })

function App() {
    const [markers, setMarkers] = useState<MarkerData[]>(() => {
        if (typeof window === 'undefined') return []
        const stored = localStorage.getItem('savedMarkers')
        return stored ? JSON.parse(stored) : []
    })
    const [subscriptions, setSubscriptions] = useState<string[]>(() => {
        if (typeof window === 'undefined') return []
        const stored = localStorage.getItem('subscriptions')
        return stored ? JSON.parse(stored) : []
    })
    const [clickPosition, setClickPosition] = useState<[number, number] | null>(null)
    const [editing, setEditing] = useState(false)
    const [formData, setFormData] = useState({ name: '', hour: '', description: '' })

    useEffect(() => {
        localStorage.setItem('savedMarkers', JSON.stringify(markers))
    }, [markers])

    useEffect(() => {
        localStorage.setItem('subscriptions', JSON.stringify(subscriptions))
    }, [subscriptions])

    const handleSaveMarker = (marker: MarkerData) => {
        setMarkers((current) => [...current, marker])
        setClickPosition(null)
        setEditing(false)
        setFormData({ name: '', hour: '', description: '' })
    }

    const handleSubscribe = (markerId: string) => {
        setSubscriptions((current) =>
            current.includes(markerId) ? current : [...current, markerId],
        )
    }

    const handleUnsubscribe = (markerId: string) => {
        setSubscriptions((current) => current.filter((id) => id !== markerId))
    }

    const subscribedMarkers = markers.filter((marker) => subscriptions.includes(marker.id))
    const orderedSubscribedMarkers = [...subscribedMarkers].sort(
        (a, b) => parseHour(a.hour) - parseHour(b.hour),
    )
    const subscriptionPath = orderedSubscribedMarkers.map((marker) => marker.position)

    return (
        <div className="map-shell">
            <MapContainer className="leaflet-container" center={barcelonaCenter} zoom={14} style={{ height: '100vh', width: '100vw' }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                <Marker position={barcelonaCenter}>
                    <Popup>
                        Barcelona center: Plaça de Catalunya.
                    </Popup>
                </Marker>

                <Polyline positions={busRoute} pathOptions={{ color: 'red', weight: 6, opacity: 0.75 }} />

                <Marker position={busRoute[0]}>
                    <Popup>Bus route start</Popup>
                </Marker>
                <Marker position={busRoute[busRoute.length - 1]}>
                    <Popup>Bus route end</Popup>
                </Marker>

                <EventMarkers
                    markers={markers}
                    subscribedIds={subscriptions}
                    onSubscribe={handleSubscribe}
                    clickPosition={clickPosition}
                    editing={editing}
                    setEditing={setEditing}
                    formData={formData}
                    setFormData={setFormData}
                    onClickLocation={setClickPosition}
                    onSaveMarker={handleSaveMarker}
                />

                {orderedSubscribedMarkers.length > 1 && (
                    <>
                        <Polyline
                            positions={subscriptionPath}
                            pathOptions={{ color: '#1d4ed8', weight: 4, opacity: 0.8, dashArray: '10,8' }}
                        />
                        {orderedSubscribedMarkers.slice(0, -1).map((marker, index) => {
                            const next = orderedSubscribedMarkers[index + 1]
                            const midpoint: [number, number] = [
                                (marker.position[0] + next.position[0]) / 2,
                                (marker.position[1] + next.position[1]) / 2,
                            ]
                            return (
                                <Marker
                                    key={`${marker.id}-arrow`}
                                    position={midpoint}
                                    icon={createArrowIcon(getBearing(marker.position, next.position))}
                                    interactive={false}
                                />
                            )
                        })}
                    </>
                )}
            </MapContainer>

            <div className="sidebar-overlay">
                <SubscriptionPanel subscribedMarkers={orderedSubscribedMarkers} onRemoveSubscription={handleUnsubscribe} />
            </div>
        </div>
    )
}

export default App