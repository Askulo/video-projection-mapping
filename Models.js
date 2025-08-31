import * as THREE from 'three';

export default class Models {
    constructor(gl_app) {
        this.gl_app = gl_app;

        this.grids_config = [
            {
                id: 'heart',
                mask: `heart.jpg`,
                video: `fruits_trail_squared-transcode.mp4`
            },
            {
                id: 'codrops',
                mask: `codrops.jpg`,
                video: `KinectCube_1350-transcode.mp4`
            },
            {
                id: 'smile',
                mask: `smile.jpg`,
                video: `infinte-grid_squared-transcode.mp4`
            },
        ]
        
        this.grids = [];
        this.gridsLoaded = 0;
        
        // Create a group to hold all the models
        this.group = new THREE.Group();
        this.gl_app.scene.add(this.group);
        
        this.gridSize = 24;
        this.spacing = 0.75;
        
        // Store data for each grid separately
        this.gridData = new Map(); // Will store: gridWidth, gridHeight, data, material for each config
        
        this.grids_config.forEach((config, index) => this.createMask(config, index));
    }
    
    createVideoTexture(config, index) {
        const video = document.createElement('video');
        video.src = `../videos/${config.video}`;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.play();

        // Create video texture
        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.wrapS = THREE.ClampToEdgeWrap;
        videoTexture.wrapT = THREE.ClampToEdgeWrap;

        // Create material with video texture
        const material = new THREE.MeshBasicMaterial({
            map: videoTexture,
            side: THREE.FrontSide
        });
        
        // Store material in gridData for this specific config
        const gridInfo = this.gridData.get(config.id) || {};
        gridInfo.material = material;
        this.gridData.set(config.id, gridInfo);
        
        return material;
    }

    createMask(config, index) {
        // Create a canvas to read mask pixel data
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const maskImage = new Image();
        maskImage.crossOrigin = 'anonymous';
        
        maskImage.onload = () => {
            // Get original image dimensions to preserve aspect ratio
            const originalWidth = maskImage.width;
            const originalHeight = maskImage.height;
            const aspectRatio = originalWidth / originalHeight;

            // Calculate grid dimensions based on aspect ratio
            let gridWidth, gridHeight;
            if (aspectRatio > 1) {
                // Image is wider than tall
                gridWidth = this.gridSize;
                gridHeight = Math.round(this.gridSize / aspectRatio);
            } else {
                // Image is taller than wide or square
                gridHeight = this.gridSize;
                gridWidth = Math.round(this.gridSize * aspectRatio);
            }

            canvas.width = gridWidth;
            canvas.height = gridHeight;
            ctx.drawImage(maskImage, 0, 0, gridWidth, gridHeight);

            const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);

            // Store all data for this specific grid
            this.gridData.set(config.id, {
                gridWidth: gridWidth,
                gridHeight: gridHeight,
                data: imageData.data,
                material: null // Will be set by createVideoTexture
            });

            // Now create the grid
            this.createGrid(config, index);
        };

        maskImage.src = `../images/${config.mask}`;
    }
    
    createGrid(config, index) {
        // Create video texture and material for this specific grid
        this.createVideoTexture(config, index);
        
        // Get the stored data for this specific grid
        const gridInfo = this.gridData.get(config.id);
        const { gridWidth, gridHeight, data, material } = gridInfo;
        
        const grid_group = new THREE.Group();
        this.group.add(grid_group);

        for (let x = 0; x < gridWidth; x++) {
            for (let y = 0; y < gridHeight; y++) {
                
                const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);

                // Get pixel color from mask (sample at grid position)
                // Flip Y coordinate to match image orientation
                const flippedY = gridHeight - 1 - y;
                const pixelIndex = (flippedY * gridWidth + x) * 4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];

                // Calculate brightness (0 = black, 255 = white)
                const brightness = (r + g + b) / 3;

                // Only create box if pixel is dark (black shows, white hides)
                if (brightness < 128) { // Threshold for black vs white

                    // Create individual geometry for each box to have unique UV mapping
                    // Calculate UV coordinates for this specific box
                    const uvX = x / gridWidth;
                    const uvY = y / gridHeight; // Use actual grid dimensions
                    const uvWidth = 1 / gridWidth;
                    const uvHeight = 1 / gridHeight;
                    
                    // Get the UV attribute
                    const uvAttribute = geometry.attributes.uv;
                    const uvArray = uvAttribute.array;
                    
                    // Map each face of the box to show the same portion of video
                    // We'll focus on the front face (face 4) for the main projection
                    for (let i = 0; i < uvArray.length; i += 2) {
                        // Map all faces to the same UV region for consistency
                        uvArray[i] = uvX + (uvArray[i] * uvWidth);     // U coordinate
                        uvArray[i + 1] = uvY + (uvArray[i + 1] * uvHeight); // V coordinate
                    }
                    
                    // Mark the attribute as needing update
                    uvAttribute.needsUpdate = true;
                    
                    const mesh = new THREE.Mesh(geometry, material);

                    mesh.position.x = (x - (gridWidth - 1) / 2) * this.spacing;
                    mesh.position.y = (y - (gridHeight - 1) / 2) * this.spacing;
                    mesh.position.z = 0;

                    grid_group.add(mesh);
                }
            }
        }
        
        grid_group.name = config.id;
        this.grids.push(grid_group);
        
        // Position grids at the same location (they'll be switched via interactions)
        grid_group.position.x = 0;
        grid_group.position.y = 0;
        grid_group.position.z = 0;
        
        console.log(`Grid ${config.id} created with ${grid_group.children.length} cubes`);
        
        // Increment loaded counter
        this.gridsLoaded++;
        
        // Check if all grids are loaded
        if (this.gridsLoaded === this.grids_config.length) {
            this.group.scale.setScalar(0.5);
            this.is_ready = true;
            this.initInteractions(); // Initialize interactions after all grids are loaded
            console.log('All grids loaded and interactions initialized');
        }
    }

    // Initialize interaction system
    initInteractions() {
        this.current = 'heart';
        this.old = null;
        this.is_animating = false;
        this.duration = 1;

        this.DOM = {
            $btns: document.querySelectorAll('.btns__item button'),
            $canvas: document.querySelector('canvas')
        };

        // Hide all grids except the current one
        this.grids.forEach(grid => {
            if (grid.name !== this.current) {
                grid.children.forEach(mesh => {
                    mesh.scale.setScalar(0);
                    mesh.position.z = -6; // Position off-screen
                });
            }
        });

        this.bindEvents();
    }

    // Bind button events
    bindEvents() {
        if (!this.DOM.$btns.length) {
            console.warn('No buttons found with selector .btns__item button');
            return;
        }

        this.DOM.$btns.forEach(($btn, index) => {
            $btn.addEventListener('click', () => {
                if (this.is_animating) return;
                
                const newGridId = $btn.dataset.id;
                
                // Don't animate if clicking the same button
                if (newGridId === this.current) return;

                this.is_animating = true;

                // Update button states
                this.DOM.$btns.forEach(($button, btnIndex) => {
                    if (btnIndex === index) {
                        $button.classList.add('active');
                    } else {
                        $button.classList.remove('active');
                    }
                });

                this.old = this.current;
                this.current = newGridId;
                
                this.revealGrid();
                this.hideGrid();
            });
        });
    }

    // Reveal the new grid
    revealGrid() {
        const grid = this.grids.find(item => item.name === this.current);
        
        if (!grid) {
            console.warn(`Grid with name ${this.current} not found`);
            return;
        }

        // Update canvas background with smooth color transition
        this.updateBackgroundColor();

        const tl = gsap.timeline({ 
            delay: this.duration * 0.25, 
            defaults: { ease: 'power1.out', duration: this.duration } 
        });

        grid.children.forEach((child, index) => {
            tl.to(child.scale, { 
                x: 1, 
                y: 1, 
                z: 1, 
                ease: 'power3.inOut' 
            }, index * 0.001)
            .to(child.position, { 
                z: 0 
            }, '<');
        });
    }

    // Hide the old grid
    hideGrid() {
        if (!this.old) {
            this.is_animating = false;
            return;
        }

        const grid = this.grids.find(item => item.name === this.old);
        
        if (!grid) {
            console.warn(`Grid with name ${this.old} not found`);
            this.is_animating = false;
            return;
        }

        const tl = gsap.timeline({
            defaults: { ease: 'power1.out', duration: this.duration },
            onComplete: () => { 
                this.is_animating = false;
            }
        });

        grid.children.forEach((child, index) => {
            tl.to(child.scale, { 
                x: 0, 
                y: 0, 
                z: 0, 
                ease: 'power3.inOut' 
            }, index * 0.001)
            .to(child.position, {
                z: 6, 
                onComplete: () => {
                    gsap.set(child.scale, { x: 0, y: 0, z: 0 });
                    gsap.set(child.position, { z: -6 });
                }
            }, '<');
        });
    }

    // Method to programmatically switch grids
    switchToGrid(gridId) {
        const button = Array.from(this.DOM.$btns).find(btn => btn.dataset.id === gridId);
        if (button) {
            button.click();
        } else {
            console.warn(`No button found for grid ID: ${gridId}`);
        }
    }

    // UPDATED: Simplified background color animation - only animate body background
    updateBackgroundColor() {
        // Color mapping for each grid
        const colorMap = {
            heart: '#e19800',
            codrops: '#00a00b',
            smile: '#b90000'
        };

        // Get the target color
        const targetColor = colorMap[this.current] || '#1a1a1a';

        // Animate body background color with GSAP
        gsap.to(document.body, {
            backgroundColor: targetColor,
            duration: this.duration * 0.8,
            ease: 'power2.out'
        });
    }

    // Enhanced method to set custom colors for grids
    setGridColors(colorMap) {
        this.gridColors = { ...colorMap };
    }

    // Get current grid color
    getCurrentColor() {
        const colorMap = {
            heart: '#e19800',
            codrops: '#00a00b',
            smile: '#b90000'
        };
        return colorMap[this.current] || '#1a1a1a';
    }

    // Cleanup method
    destroy() {
        if (this.DOM.$btns) {
            this.DOM.$btns.forEach($btn => {
                $btn.removeEventListener('click', this.handleButtonClick);
            });
        }
    }
}