/**
 * Register all agent skills
 * Import all skill modules to register them
 */

// Navigation skills
import './navigation';

// Extraction skills
import './extract_table';
import './paginate_and_extract';
import './shadow_map';

// Export skills
import './export_csv';
import './export_sqlite';

// Document skills
import './pdf-parser';

// Media skills
import './yt-transcript';

// This file ensures all skills are registered when imported
export { registry } from './registry';

