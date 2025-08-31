import * as THREE from 'three';
import Models from './Models.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export default class App {
    constructor() {
        this.initScene();
        this.initLights();

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        
        // Instantiate the Models class and pass 'this' (the App instance)
        this.models = new Models(this); 
        
        this.is_ready = false;
        this.update();
        window.addEventListener('resize', this.onResize.bind(this));
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
    }
    
    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 100);
        pointLight.position.set(5, 5, 5);
        this.scene.add(pointLight);
    }
    
    update() {
        // Use requestAnimationFrame for the render loop
        requestAnimationFrame(this.update.bind(this));

         // Update the controls
    this.controls.update(); 

        // Wait until models are ready before doing anything with them
        if (this.models.is_ready) {
            this.models.group.children.forEach((model, index) => {
                model.position.z = Math.sin(Date.now() * 0.005 + index * 0.1) * 0.12;
            });
        }
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}