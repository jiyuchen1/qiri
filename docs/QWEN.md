# Qwen Code Context: Containment Object - Skill Topology Visualization

## Project Overview

This project involves designing and implementing an interactive "Containment Object - Skill" relationship topology visualization interface. Based on the "Seven Days of the World" setting, containment objects are similar to battle pets with skill pools extracted from a full skill set. Different containment objects have overlapping skill pools.

### Main Purpose
- Create a visualization interface that intuitively displays the mapping and overlapping relationships between containment objects and skills
- Enable exploration and analysis of skill ecosystems for game designers and players

### Key Features
- **Bipartite Graph Visualization**: Shows relationships between containment objects and skills in a two-part graph structure
- **Multiple Layout Options**: Layered dual-column layout, force-directed layout, and skill category grouping layout
- **Skill Overlap Highlighting**: Emphasizes popular skills and overlapping relationships between containment objects
- **Search and Filtering**: Supports keyword search, filtering by rarity, category, and other attributes
- **Interactive Elements**: Hover tooltips, node selection, highlighting of related elements
- **Data Export/Import**: Import JSON data and export visualizations in various formats

## Technology Stack

- Frontend: HTML/CSS/JavaScript
- Visualization Libraries: Cytoscape.js, ECharts (with WebGL support), or D3.js
- Rendering: WebGL-based for optimal performance with 200-500 containment objects and 150-400 skills

## Data Model

### Input Data Structure
- **Containment Object**: `{ id, name, rarity, faction?, tags?, skills: [skillId...] }`
- **Skill Object**: `{ id, name, category, type, rarity?, tags? }`
- **Optional Statistics**: `{ unlockLevel?, cost?, power?, synergyTags? }`

### Data Requirements
- Example dataset with ≥10 containment objects and ≥25 skills
- Intentional skill overlaps to demonstrate shared core skills
- Data-interface decoupling with `loadData(json)` method for dynamic data replacement

## Visualization Design

### Graph Model
- **Bipartite Graph**: Left side for containment objects, right side for skills, with edges representing "containment object has skill"
- **Layout Options**: 
  - Layered dual-column layout
  - Force-directed layout
  - Skill category grouping layout

### Visual Encoding
- **Node Shape/Color**: Distinguish between containment objects and skill nodes
- **Color/Icons**: Encode rarity for containment objects and categories for skills
- **Node Size**: Map skill node size to usage frequency (degree) to show "hot skills"
- **Edge Styling**: Adjust thickness and opacity based on weights or rarity

### Overlap Expression
- **Popular Skill Highlighting**: Use heat color gradients or glowing borders to show highly referenced skills
- **Similarity Mode**: Calculate containment object similarity using Jaccard index, showing relationships above threshold
- **Category Grouping**: Use background partitions or enclosing contours to represent skill categories

## Interactive Features

### Basic Interactions
- **Hover Tooltips**: Show name, type, rarity, and skill lists
- **Node Click Focus**: Highlight adjacent edges and nodes, fade others, show details in sidebar
- **Box/Multi-Selection**: Support comparison of multiple containment objects or skills

### Search and Filter
- **Keyword Search**: Fuzzy matching for names and tags
- **Filter Conditions**: By rarity, tags, categories, reference counts, and overlap-only
- **Quick Highlight**: Highlight high-overlap containment objects and popular skills

### View Controls
- **Layout Toggle**: Switch between layouts, reset view, zoom/pan, fix/unfix nodes
- **Label Toggle**: Control visibility of labels and density settings
- **Mini Map**: Optional overview of the entire graph

### Analysis and Statistics
- **Skill Popularity Ranking**: Sort by reference count
- **Similarity Pairs**: Top N pairs with clickable items to show temporary views
- **Global Metrics**: Node/edge count, average degree, max degree, overlap distribution histogram

## Performance Requirements

### Target Scale
- 200-500 containment objects
- 150-400 skills
- Up to 5,000-15,000 edges

### Optimization Strategies
- Use WebGL-enabled visualization libraries
- Progressive rendering and zoom-based LOD (Level of Detail)
- Web Workers for high-cost calculations like similarity measures
- Caching of degree and similarity results with incremental updates

## Development Guidelines

### Code Structure
- Modular code with clear separation of concerns
- Well-commented implementation covering:
  - Data loading and validation
  - Graph construction and updates
  - Layout control
  - Interaction logic
  - Filter and search functionality
  - Statistical calculations
  - Export features

### Styling and Responsiveness
- Theme support (optional dark/light mode)
- Responsive layout for desktop and 1366×768 screen adaptation

## Delivery Requirements

### Deliverables
1. **Design Documentation**: Brief overview of graph model choices, encoding mappings, layout trade-offs, and performance strategies
2. **Sample Data**: JSON dataset with comments explaining field meanings
3. **Frontend Code**: Complete, runnable HTML/CSS/JS implementation with clear comments
4. **Usage Guide**: Instructions for local execution and data replacement
5. **Extension Suggestions**: Optional recommendations for alternative technology stacks

### Running Instructions
- The implementation should run directly when opening the HTML file in a browser
- Clear instructions for replacing the default dataset with custom JSON data
- Explanation of how to extend into a componentized structure if needed

## Technical Implementation Notes

The project should prioritize:
- Performance with WebGL-based visualization libraries
- Clean, maintainable code with modular design
- Intuitive user interface for exploring complex relationships
- Extensibility for future enhancements like time dimension comparisons or distributed data sources