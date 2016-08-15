(function() {
	var ThreeGazeClicker = E2.plugins.three_gaze_clicker = function(core) {
		this.desc = 'Gaze Clicker'
		Plugin.apply(this, arguments)

		this.core = core

		this.iconDistance = 0.030
		this.iconDepth = -1.0
		this.iconSize = 0.1

		this.input_slots = [
			{name: 'camera', dt: core.datatypes.CAMERA},
			{name: 'scene', dt: core.datatypes.SCENE},
			{name: 'delay', dt: core.datatypes.FLOAT, def: 1.0},
			{name: 'show icon', dt: core.datatypes.BOOL, def: true},
			{name: 'icon depth', dt: core.datatypes.FLOAT, def: this.iconDepth,
				desc: 'Gaze Cursor icon distance from camera'},
			{name: 'icon size', dt: core.datatypes.FLOAT, def: this.iconSize,
				desc: 'Gaze Cursor icon size'}
		]

		this.output_slots = [
			{name: 'scene', dt: core.datatypes.SCENE},
			{name: 'object', dt: core.datatypes.OBJECT3D}
		]

		this.always_update = true

		this.clickDelay = 1.0

		this.showIcon = true
	}

	ThreeGazeClicker.prototype = Object.create(Plugin.prototype)

	ThreeGazeClicker.prototype.reset = function() {
		this.clickFactor = 0.0
		this.clickTime = 0.0
	}

	ThreeGazeClicker.prototype.update_input = function(slot, data) {
		// no inputs

		switch (slot.index) {
		case 0: // camera
			this.camera = data
			break
		case 1: // scene
			this.scene = data
			break
		case 2: // delay
			this.clickDelay = data
			break
		case 3: // icon
			this.showIcon = data
			break
		default:
			break
		}

		if (slot.name === 'icon depth') {
			this.iconDepth = data

			if (this.scene.children[1].children.indexOf(this.object3d) >= 0) {
				this.scene.children[1].remove(this.object3d)
			}
			this.object3d = undefined
		}

		if (slot.name === 'icon size') {
			this.iconSize = data

			if (this.scene.children[1].children.indexOf(this.object3d) >= 0) {
				this.scene.children[1].remove(this.object3d)
			}
			this.object3d = undefined
		}
	}

	ThreeGazeClicker.prototype.update_output = function(slot) {
		if (slot.index === 0) {
			return this.scene
		}
		else if (slot.index === 1) {
			return this.lastObj
		}
	}

	ThreeGazeClicker.prototype.state_changed = function(ui) {
		if (!ui) {

		}
	}

	// geometry ---
	ThreeGazeClicker.prototype.GeometryGenerator = function(parent) {
		this.type = 'Gaze Aim'

		this.segments = 16
		this.radialMarkers = [0, 0.3, 0.8, 1.0]

		var that = this

		this.initialise = function() {
			THREE.Geometry.call(that)

			that.dynamic = true

			var i, j

			for (j = 0; j < that.segments + 1; j++) {
				for (i = 0; i < that.radialMarkers.length; i++) {
					that.vertices.push(new THREE.Vector3())
				}
			}
			var normal = new THREE.Vector3(0,0,1)

			for (j = 0; j < that.segments; j++) {
				for (i = 0; i < that.radialMarkers.length; i += 2) {
					var faceidxa = (j) * that.radialMarkers.length + i
					var faceidxb = (j) * that.radialMarkers.length + i + 1
					var faceidxc = (j + 1) * that.radialMarkers.length + i
					var faceidxd = (j + 1) * that.radialMarkers.length + i + 1

					that.faces.push(new THREE.Face3(faceidxa, faceidxb, faceidxc, normal))
					that.faces.push(new THREE.Face3(faceidxb, faceidxd, faceidxc, normal))

					that.faces.push(new THREE.Face3(faceidxa, faceidxc, faceidxb, normal))
					that.faces.push(new THREE.Face3(faceidxb, faceidxc, faceidxd, normal))
				}
			}
		}

		this.initialise()

		this.update = function(fillfactor, fadeoutfactor) {
			var idx = 0

			var radialMarkers = this.radialMarkers.slice(0)

			if (fadeoutfactor >= 1) {
				radialMarkers[2] = this.radialMarkers[2] + (this.radialMarkers[1] - this.radialMarkers[2]) * fillfactor
			}
			else {
				radialMarkers[2] = this.radialMarkers[1] + (this.radialMarkers[3] - this.radialMarkers[1]) * (1 - fadeoutfactor)
			}

			var i, j

			var clickerDepth = parent.iconDepth // slightly farther away than camera near plane to prevent z fighting
			var clickerRadius = parent.iconSize

			for (j = 0; j < that.segments + 1; j++) {
				for (i = 0; i < radialMarkers.length; i++) {
					var angle = j / that.segments

					// clamp outer ring
					if (i > 1) {
						angle = Math.min(angle, fillfactor)
					}

					angle *= 3.14159 * 2

					var x = Math.sin(angle)
					var y = Math.cos(angle)

					var f = radialMarkers[i]

					//if (i > 1) {
					//	f *= fadeoutfactor
					//}

					that.vertices[idx].set(x * f * clickerRadius, y * f * clickerRadius, clickerDepth)

					idx++
				}
			}

			that.verticesNeedUpdate = true
		}
	}

	ThreeGazeClicker.prototype.GeometryGenerator.prototype = Object.create(THREE.Geometry.prototype)
	ThreeGazeClicker.prototype.GeometryGenerator.prototype.constructor = ThreeGazeClicker.prototype.GeometryGenerator

	// --- geometry

	ThreeGazeClicker.prototype.get_mesh = function() {
		if (!this.object3d) {
			this.geometry = new this.GeometryGenerator(this)
			this.material = new THREE.MeshBasicMaterial({color:0xffffff, depthFunc: THREE.AlwaysDepth})

			// mono eye icon
			var monoEyeIcon = new THREE.Mesh(this.geometry, this.material)
			monoEyeIcon.matrixAutoUpdate = false

			this.object3d = monoEyeIcon
		}

		return this.object3d
	}

	ThreeGazeClicker.prototype.update_click = function(updateContext) {
		if (!this.raycaster) {
			this.raycaster = new THREE.Raycaster()
		}

		this.camera.updateMatrixWorld()

		this.raycaster.setFromCamera(new THREE.Vector3(0, 0, 0), this.camera)
		var intersects = this.raycaster.intersectObjects(this.scene.children[0].children, /*recursive =*/ true)

		var hadObj = false

		if (intersects.length > 0) {
			var obj = intersects[0].object

			// traverse the hierarchy back
			// we need to find an object with:
			// - a positive gazeClickerCount (something is tracking its clickable state)
			// - a reference back to a node (it is a object3d plugin's root object)
			while (obj && !obj.gazeClickerCount && !(obj.backReference && obj.backReference.object3d === obj)) {
				obj = obj.parent
			}

			if (obj && obj.gazeClickerCount) {
				if (obj !== this.lastObj) {
					this.objTimer = updateContext.abs_t
					this.lastObj = obj

					E2.core.runtimeEvents.emit('gazeIn:'+this.lastObj.uuid)
				}

				hadObj = true
			}
		}

		if (!hadObj) {
			if (this.lastObj)
				E2.core.runtimeEvents.emit('gazeOut:'+this.lastObj.uuid)

			this.lastObj = undefined
			this.objTimer = undefined
		}

		if (this.lastObj) {
			this.clickTime = updateContext.abs_t - this.objTimer
			var clickFactor = Math.min(this.clickTime, this.clickDelay) / this.clickDelay // 0..1

			if (this.clickFactor < 1 && clickFactor >= 1) {
				// only click once when the timer passes this.clickDelay (default 1 second)
				if (this.lastObj.onClick)
					this.lastObj.onClick()

				E2.core.runtimeEvents.emit('gazeClicked:'+this.lastObj.uuid)
			}

			this.clickFactor = clickFactor
		} else {
			this.clickFactor = 0
			this.clickTime = 0
		}
	}

	ThreeGazeClicker.prototype.update_state = function(updateContext) {
		if (!this.scene || !this.camera) {
			return
		}

		var isActive = true

		if (isActive) {
			this.update_click(updateContext)
		}

		var mesh = this.get_mesh()

		if (isActive && this.scene.hasClickableObjects && this.showIcon !== false) {
			mesh.matrix.copy(this.camera.matrixWorld)

			this.geometry.update(this.clickFactor, Math.max(1.0 - Math.max(0.0, this.clickTime - this.clickDelay) * 10.0, 0.0))

			if (this.scene.children[1].children.indexOf(mesh) < 0) {
				this.scene.children[1].add(mesh)
			}
		}
		else {
			if (this.scene.children[1].children.indexOf(mesh) >= 0) {
				this.scene.children[1].remove(mesh)
			}
		}
	}
})()