import { microcontrollerTemplates } from './microcontroller'
import { powerTemplates } from './power'
import { sensorsTemplates } from './sensors'
import { mechanicalTemplates } from './mechanical'
import { rfTemplates } from './rf'
import { mixedTemplates } from './mixed'

export const templates = [
  ...microcontrollerTemplates,
  ...powerTemplates,
  ...sensorsTemplates,
  ...mechanicalTemplates,
  ...rfTemplates,
  ...mixedTemplates
]

export const templateCategories = [
  'All',
  'Microcontroller',
  'Power',
  'Sensors',
  'Mechanical',
  'RF & Networking',
  'Mixed & Analog',
  'Community'
]
