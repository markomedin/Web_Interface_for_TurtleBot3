var canvas = document.getElementById('my_canvas');
var context = canvas.getContext('2d');
var BB = canvas.getBoundingClientRect();

var test_zoom = 2;

// Povezivanje sa ROS-om.
// ---------------------

var ros = new ROSLIB.Ros();
document.getElementById('connectionStatus').value = 'Status veze';

ros.on('connection', function() {
  console.log('Povezan na websocket server.');
  document.getElementById('connectionStatus').value = 'Povezan';
});

ros.on('error', function(error) {
  console.log('Greška pri povezivanju na websocket server: ', error);
  document.getElementById('connectionStatus').value = 'Greška';
});

ros.on('close', function() {
  console.log('Veza sa websocket serverom zatvorena.');
  document.getElementById('connectionStatus').value = 'Zatvorena';
});

urlWS = document.getElementById('websocketServerAddress');
urlWS.value = 'ws://192.168.0.227:9090';
urlWS.oninput = function() {
  var a = urlWS.value;
  urlWS.value = a;
}

document.getElementById('connectedRobot').addEventListener('click', function(){
  ros.connect(urlWS.value);
  urdfClient.path = 'http://'+urlWS.value.substring(5, urlWS.value.length-5)+':8000';
});

document.getElementById('disconnectedRobot').addEventListener('click', function(){
  ros.close();
});

function mToCm(valueA) {
  valueA = valueA * 100;
  return valueA;
}
function cmToM(valueA) {
  valueA = valueA / 100;
  return valueA;
}

// Ispis poruke na Topic.
// ---------------------

var cmdVel = new ROSLIB.Topic({
  ros : ros,
  name : '/cmd_vel',
  messageType : 'geometry_msgs/Twist'
});

var twist = new ROSLIB.Message({
  linear : {
    x : 0,
    y : 0,
    z : 0
  },
  angular : {
    x : 0,
    y : 0,
    z : 0
  }
});
function updateTwist(twist, linearSpeedX, linearSpeedY, linearSpeedZ, angularSpeedX, angularSpeedY, angularSpeedZ) {
  twist.linear.x = linearSpeedX;
  twist.linear.y = linearSpeedY;
  twist.linear.z = linearSpeedZ;
  twist.angular.x = angularSpeedX;
  twist.angular.y = angularSpeedY;
  twist.angular.z = angularSpeedZ;
}

// Prijavljivanje na Topic.
// -----------------------

var laserScanListener = new ROSLIB.Topic({
  ros : ros,
  name : '/scan',
  messageType : 'sensor_msgs/LaserScan'
});

var jointStatesListener = new ROSLIB.Topic({
  ros : ros,
  name : '/joint_states',
  messageType : 'sensor_msgs/JointState'
});

var odometryListener = new ROSLIB.Topic({
  ros : ros,
  name : '/odom',
  messageType : 'nav_msgs/Odometry'
});

function Odometry(posePointPositionX, posePointPositionY, posePointPositionZ, poseQuaternionOrientationX, poseQuaternionOrientationY, poseQuaternionOrientationZ, poseQuaternionOrientationW) {
  this.posePointPositionX = posePointPositionX;
  this.posePointPositionY = posePointPositionY;
  this.posePointPositionZ = posePointPositionZ;
  this.poseQuaternionOrientationX = poseQuaternionOrientationX;
  this.poseQuaternionOrientationY = poseQuaternionOrientationY;
  this.poseQuaternionOrientationZ = poseQuaternionOrientationZ;
  this.poseQuaternionOrientationW = poseQuaternionOrientationW;
  this.update = function(posePointPositionX, posePointPositionY, posePointPositionZ, poseQuaternionOrientationX, poseQuaternionOrientationY, poseQuaternionOrientationZ, poseQuaternionOrientationW) {
    this.posePointPositionX = posePointPositionX;
    this.posePointPositionY = posePointPositionY;
    this.posePointPositionZ = posePointPositionZ;
    this.poseQuaternionOrientationX = poseQuaternionOrientationX;
    this.poseQuaternionOrientationY = poseQuaternionOrientationY;
    this.poseQuaternionOrientationZ = poseQuaternionOrientationZ;
    this.poseQuaternionOrientationW = poseQuaternionOrientationW;
  }
}
var odometryData = new Odometry(0,0,0,0,0,0,0);
function convertQuaternionToEuler(object) {
  // Funkcija konvertuje uglove orijentacije u prostoru iz quaternion u euler.
  var quat = new THREE.Quaternion(
    object.poseQuaternionOrientationX,
    object.poseQuaternionOrientationY,
    object.poseQuaternionOrientationZ,
    object.poseQuaternionOrientationW
  );
  var euler = new THREE.Euler();
  euler.setFromQuaternion(quat);
  return euler;
}
var eulerFromQuaternion = convertQuaternionToEuler(odometryData);

// Kreiranje glavnog prikaza.
var viewer = new ROS3D.Viewer({
  divID : 'ros3djsDisplay',
  width : 500,
  height : 500,
  background : "#F2F2F2",
  intensity : 0.8,
  antialias : true,
  cameraPose: {
  x : 0,
  y : -10,
  z : 10}
});

// Dodavanje mreže glavnom prikazu.
var grid3D = new ROS3D.Grid({
  num_cells: 10,
  color: "#B0C9D9",
  cellSize: 1/test_zoom
});
viewer.addObject(grid3D);

// Dodavanje dodatnog osvetljenja 3D sceni glavnog prikaza.
viewer.directionalLight.position.set( 10, 10, 10 );
var directionalLight1 = new THREE.DirectionalLight( 0xFFFFFF, 0.2 );
directionalLight1.position.set( 10, -10, 4 );
directionalLight1.castShadow = true;
viewer.scene.add( directionalLight1 );
var directionalLight2 = new THREE.DirectionalLight( 0xFFFFFF, 0.4 );
directionalLight2.position.set( -10, 10, 6 );
directionalLight2.castShadow = true;
viewer.scene.add( directionalLight2 );
var directionalLight3 = new THREE.DirectionalLight( 0xFFFFFF, 0.6 );
directionalLight3.position.set( -10, -10, 8 );
directionalLight3.castShadow = true;
viewer.scene.add( directionalLight3 );

// Registracija koordinatnog sistema klijenta u odnosu na globalni koordinatni sistem.
var tfClient = new ROSLIB.TFClient({
  ros : ros,
  fixedFrame : 'odom',
  angularThres : 0.01,
  transThres : 0.01,
  rate : 10.0
});

// Registracija URDF klijenta, 3D model koji je vezan za koordinatni sistem klijenta.
var urdfClient = new ROS3D.UrdfClient({
  ros : ros,
  tfClient : tfClient,
  path : 'http://'+urlWS.value.substring(5, urlWS.value.length-5)+':8000',
  rootObject : viewer.scene,
});

var xPositionInput = document.getElementById('xPositionInput');
var yPositionInput = document.getElementById('yPositionInput');
var thetaAngleInput = document.getElementById('thetaAngleInput');
var wallPXSInput = document.getElementById('wallPXSInput');
var wallPYSInput = document.getElementById('wallPYSInput');
var wallPXEInput = document.getElementById('wallPXEInput');
var wallPYEInput = document.getElementById('wallPYEInput');

document.getElementById('xPositionInput').disabled = true;
document.getElementById('yPositionInput').disabled = true;
document.getElementById('thetaAngleInput').disabled = true;
document.getElementById('wallPXSInput').disabled = true;
document.getElementById('wallPYSInput').disabled = true;
document.getElementById('wallPXEInput').disabled = true;
document.getElementById('wallPYEInput').disabled = true;

var xPositionRange = document.getElementById("xPositionRange");
var yPositionRange = document.getElementById('yPositionRange');
var thetaAngleRange = document.getElementById('thetaAngleRange');
var wallPXSRange = document.getElementById('wallPXSRange');
var wallPYSRange = document.getElementById('wallPYSRange');
var wallPXERange = document.getElementById('wallPXERange');
var wallPYERange = document.getElementById('wallPYERange');


document.getElementById("xPositionRange").disabled = true;
document.getElementById('yPositionRange').disabled = true;
document.getElementById('thetaAngleRange').disabled = true;
document.getElementById('wallPXSRange').disabled = true;
document.getElementById('wallPYSRange').disabled = true;
document.getElementById('wallPXERange').disabled = true;
document.getElementById('wallPYERange').disabled = true;

xPositionRange.min = -250;
xPositionRange.max = 250;
xPositionRange.step = 1;
xPositionRange.value = 0;
xPositionInput.min = -250;
xPositionInput.max = 250;
xPositionInput.step = 1;
xPositionInput.value = 0;
yPositionRange.min = -250;
yPositionRange.max = 250;
yPositionRange.step = 1;
yPositionRange.value = 0;
yPositionInput.min = -250;
yPositionInput.max = 250;
yPositionInput.step = 1;
yPositionInput.value = 0;
thetaAngleRange.min = 0;
thetaAngleRange.max = 360;
thetaAngleRange.step = 1;
thetaAngleRange.value = 0;
thetaAngleInput.min = 0;
thetaAngleInput.max = 360;
thetaAngleInput.step = 1;
thetaAngleInput.value = 0;
wallPXSRange.min = -250;
wallPXSRange.max = 250;
wallPXSRange.step = 1;
wallPXSRange.value = 0;
wallPXSInput.min = -250;
wallPXSInput.max = 250;
wallPXSInput.step = 1;
wallPXSInput.value = 0;
wallPYSRange.min = -250;
wallPYSRange.max = 250;
wallPYSRange.step = 1;
wallPYSRange.value = 0;
wallPYSInput.min = -250;
wallPYSInput.max = 250;
wallPYSInput.step = 1;
wallPYSInput.value = 0;
wallPXERange.min = -250;
wallPXERange.max = 250;
wallPXERange.step = 1;
wallPXERange.value = 0;
wallPXEInput.min = -250;
wallPXEInput.max = 250;
wallPXEInput.step = 1;
wallPXEInput.value = 0;
wallPYERange.min = -250;
wallPYERange.max = 250;
wallPYERange.step = 1;
wallPYERange.value = 0;
wallPYEInput.min = -250;
wallPYEInput.max = 250;
wallPYEInput.step = 1;
wallPYEInput.value = 0;

var trajectoryPointsArray = [];
var turtlebotArray = [];
var changeObject = [turtlebotArray, trajectoryPointsArray];
var objectSelect = changeObject[0];

document.getElementById("switchRobotTrajectoryPoint").checked = false;
document.getElementById("switchRobotTrajectoryPoint").disabled = true;

document.getElementById("constantSpeed").checked = false;
document.getElementById("constantSpeed").disabled = true;
document.getElementById("showGridMap").checked = false;
document.getElementById("showGridMap").disabled = true;
document.getElementById("showMap").checked = false;
document.getElementById("showMap").disabled = true;
document.getElementById("positionGraph").checked = false;
document.getElementById("positionGraph").disabled = true;

document.getElementById("showLaserScan").disabled = true;
document.getElementById("showMapLaserScan").disabled = true;
document.getElementById("createMap").disabled = true;
document.getElementById("createGridMap").disabled = true;

document.getElementById("selectOperationMode").disabled = true;
document.getElementById("goRobot").disabled = true;
document.getElementById("stopRobot").disabled = true;
document.getElementById("selectWallModel").disabled = true;
document.getElementById("importWalls").disabled = true;
document.getElementById("wallArrayM").disabled = true;

document.getElementById("addPoint").disabled = true;
document.getElementById("changePoint").disabled = true;
document.getElementById("deletePoint").disabled = true;
document.getElementById("locationInArrayPoints").disabled = true;
document.getElementById("addWall").disabled = true;
document.getElementById("changeWall").disabled = true;
document.getElementById("deleteWall").disabled = true;
document.getElementById("locationInArrayWalls").disabled = true;
document.getElementById("deleteWalls").disabled = true;

document.getElementById("distanceToleranceRange").disabled = true;
document.getElementById("distanceToleranceInput").disabled = true;
distanceToleranceRange.min = 0;
distanceToleranceRange.max = 10;
distanceToleranceRange.step = 1;
distanceToleranceRange.value = 0;
distanceToleranceInput.min = 0;
distanceToleranceInput.max = 10;
distanceToleranceInput.step = 1;
distanceToleranceInput.value = 0;

document.getElementById("wallHeightRange").disabled = true;
document.getElementById("wallHeightInput").disabled = true;
wallHeightRange.min = 0;
wallHeightRange.max = 200;
wallHeightRange.step = 1;
wallHeightRange.value = 0;
wallHeightInput.min = 0;
wallHeightInput.max = 200;
wallHeightInput.step = 1;
wallHeightInput.value = 0;

document.getElementById("wallThicknessRange").disabled = true;
document.getElementById("wallThicknessInput").disabled = true;
wallThicknessRange.min = 0;
wallThicknessRange.max = 200;
wallThicknessRange.step = 1;
wallThicknessRange.value = 0;
wallThicknessInput.min = 0;
wallThicknessInput.max = 200;
wallThicknessInput.step = 1;
wallThicknessInput.value = 0;

var showLS = 0;
document.getElementById("showLaserScan").addEventListener('click', function(){
  if (showLS == 0) {
    showLS = 1;
    showMLS = 0;
  } else if (showLS == 1) {
    showLS = 0;
  }
});

var showMLS = 0;
document.getElementById("showMapLaserScan").addEventListener('click', function(){
  if (showMLS == 0) {
    showMLS = 1;
    showLS = 0;
  } else if (showMLS == 1) {
    showMLS = 0;
  }
});

var createM = 0;
document.getElementById("createMap").addEventListener('click', function(){
  if (createM == 0) {
    createM = 1;
  }
});

var createGM = 0;
document.getElementById("createGridMap").addEventListener('click', function(){
  if (createGM == 0) {
    createGM = 1;
  }
});

document.getElementById("selectOption").selected = "true";
document.getElementById("selectWallOption").selected = "true";

var encoderON = 0;
var linebasedEKFON = 0;
var ekfSLAMON = 0;
var aStarPSAON = 0;
document.getElementById("goRobot").addEventListener('click', function(){
  if (document.getElementById("selectOperationMode").value == 1) {
    encoderON = 1;
  } else if (document.getElementById("selectOperationMode").value == 2) {
    linebasedEKFON = 1;
  } else if (document.getElementById("selectOperationMode").value == 3) {
    ekfSLAMON = 1;
  } else if (document.getElementById("selectOperationMode").value == 4) {
    aStarPSAON = 1;
  }
});

document.getElementById("importWalls").addEventListener('click', function(){
  if (document.getElementById("selectWallModel").value == 1) {
    // ModelRoom4
    wallsMatrix.push([-150, 200, 0, 200, 100, 15],
                     [0, 200, 100, 150, 100, 15],
                     [100, 150, 200, 150, 100, 15],
                     [200, 150, 200, -100, 100, 15],
                     [150, -100, 200, -100, 100, 15],
                     [150, -100, 150, -150, 100, 15],
                     [100, -150, 150, -150, 100, 15],
                     [0, -200, 100, -150, 100, 15],
                     [-150, -200, 0, -200, 100, 15],
                     [-150, -150, -150, -200, 100, 15],
                     [-200, -150, -150, -150, 100, 15],
                     [-200, 0, -200, -150, 100, 15],
                     [-150, 100, -200, 0, 100, 15],
                     [-150, 200, -150, 100, 100, 15]);
    for (var i = 0; i < wallsMatrix.length-wI; i++) {
      createWall3D(wallsArray, walls3DArray, wallsMatrix[wI+i][0], wallsMatrix[wI+i][1], wallsMatrix[wI+i][2],
                                             wallsMatrix[wI+i][3], wallsMatrix[wI+i][4], wallsMatrix[wI+i][5], test_zoom);
      // Dodavanje 3D objekta sceni glavnog prikaza.
      viewer.selectableObjects.add(walls3DArray[wI+i]);
    }
  } else if (document.getElementById("selectWallModel").value == 2) {
    // ModelRoom5
    wallsMatrix.push([-225, 225, 225, 225, 100, 15],
                     [-225, 225, -225, -225, 100, 15],
                     [-225, -225, 225, -225, 100, 15],
                     [225, 225, 225, -225, 100, 15],
                     [135, 135, 225, 45, 100, 15],
                     [-225, -45, -135, -135, 100, 15],
                     [-135, 225, 135, -45, 100, 15],
                     [-135, 45, 135, -225, 100, 15]);
    for (var i = 0; i < wallsMatrix.length-wI; i++) {
      createWall3D(wallsArray, walls3DArray, wallsMatrix[wI+i][0], wallsMatrix[wI+i][1], wallsMatrix[wI+i][2],
                                             wallsMatrix[wI+i][3], wallsMatrix[wI+i][4], wallsMatrix[wI+i][5], test_zoom);
      // Dodavanje 3D objekta sceni glavnog prikaza.
      viewer.selectableObjects.add(walls3DArray[wI+i]);
    }
  } else if (document.getElementById("selectWallModel").value == 3) {
    // ModelRoom6
    wallsMatrix.push([-250, 300, -100, 300, 100, 15],
                     [-100, 300, 0, 250, 100, 15],
                     [0, 250, 250, 250, 100, 15],
                     [250, 250, 250, 0, 100, 15],
                     [250, 0, 300, -100, 100, 15],
                     [300, -100, 300, -200, 100, 15],
                     [300, -200, 200, -250, 100, 15],
                     [200, -250, 100, -250, 100, 15],
                     [100, -250, 100, -300, 100, 15],
                     [100, -300, -100, -300, 100, 15],
                     [-100, -300, -100, -250, 100, 15],
                     [-100, -250, -250, -250, 100, 15],
                     [-250, -250, -250, -200, 100, 15],
                     [-250, -200, -300, -200, 100, 15],
                     [-300, -200, -300, 100, 100, 15],
                     [-300, 100, -250, 100, 100, 15],
                     [-250, 100, -250, 300, 100, 15]);
    for (var i = 0; i < wallsMatrix.length-wI; i++) {
      createWall3D(wallsArray, walls3DArray, wallsMatrix[wI+i][0], wallsMatrix[wI+i][1], wallsMatrix[wI+i][2],
                                             wallsMatrix[wI+i][3], wallsMatrix[wI+i][4], wallsMatrix[wI+i][5], test_zoom);
      // Dodavanje 3D objekta sceni glavnog prikaza.
      viewer.selectableObjects.add(walls3DArray[wI+i]);
    }
  } else if (document.getElementById("selectWallModel").value == 4) {
    // ModelRoom10
    wallsMatrix.push([-450, 450, 450, 450, 100, 15],
                     [-450, -450, 450, -450, 100, 15],
                     [-450, 450, -450, -450, 100, 15],
                     [450, 450, 450, -450, 100, 15],
                     [-350, 350, 450, 350, 100, 15],
                     [-350, -350, 350, -350, 100, 15],
                     [-350, 350, -350, -350, 100, 15],
                     [350, 250, 350, -350, 100, 15],
                     [-250, 250, 350, 250, 100, 15],
                     [-250, -250, 250, -250, 100, 15],
                     [-250, 250, -250, -250, 100, 15],
                     [250, 150, 250, -250, 100, 15],
                     [-150, 150, 250, 150, 100, 15],
                     [-150, -150, 150, -150, 100, 15],
                     [-150, 150, -150, -150, 100, 15],
                     [150, 50, 150, -150, 100, 15],
                     [-50, 50, 150, 50, 100, 15],
                     [-50, -50, 50, -50, 100, 15],
                     [-50, 50, -50, -50, 100, 15]);
    for (var i = 0; i < wallsMatrix.length-wI; i++) {
      createWall3D(wallsArray, walls3DArray, wallsMatrix[wI+i][0], wallsMatrix[wI+i][1], wallsMatrix[wI+i][2],
                                             wallsMatrix[wI+i][3], wallsMatrix[wI+i][4], wallsMatrix[wI+i][5], test_zoom);
      // Dodavanje 3D objekta sceni glavnog prikaza.
      viewer.selectableObjects.add(walls3DArray[wI+i]);
    }
  }
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

wallAMI = document.getElementById('wallArrayMInput');
wallAMI.value = '';
wallAMI.oninput = function() {
  var a = wallAMI.value;
  wallAMI.value = a;
}

document.getElementById("wallArrayM").addEventListener('click', function(){
  if (wallAMI.value == '') {
  } else {
    wallsMatrix.push(JSON.parse(wallAMI.value));
    for (var i = 0; i < wallsMatrix.length-wI; i++) {
      createWall3D(wallsArray, walls3DArray, wallsMatrix[wI+i][0], wallsMatrix[wI+i][1], wallsMatrix[wI+i][2],
                                             wallsMatrix[wI+i][3], wallsMatrix[wI+i][4], wallsMatrix[wI+i][5], test_zoom);
      // Dodavanje 3D objekta sceni glavnog prikaza.
      viewer.selectableObjects.add(walls3DArray[wI+i]);
    }
  }
  wallAMI.value = '';
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

var stopR = 0;
document.getElementById("stopRobot").addEventListener('click', function(){
  if (stopR == 0) {
    stopR = 1;
  }
});

document.getElementById("platformS").addEventListener('click', function(){
  document.getElementById('xPositionInput').disabled = false;
  document.getElementById('yPositionInput').disabled = false;
  document.getElementById('thetaAngleInput').disabled = false;
  document.getElementById('wallPXSInput').disabled = false;
  document.getElementById('wallPYSInput').disabled = false;
  document.getElementById('wallPXEInput').disabled = false;
  document.getElementById('wallPYEInput').disabled = false;
  document.getElementById("xPositionRange").disabled = false;
  document.getElementById('yPositionRange').disabled = false;
  document.getElementById('thetaAngleRange').disabled = false;
  document.getElementById('wallPXSRange').disabled = false;
  document.getElementById('wallPYSRange').disabled = false;
  document.getElementById('wallPXERange').disabled = false;
  document.getElementById('wallPYERange').disabled = false;
  document.getElementById("addPoint").disabled = false;
  document.getElementById("switchRobotTrajectoryPoint").disabled = false;
  document.getElementById("changePoint").disabled = false;
  document.getElementById("deletePoint").disabled = false;
  document.getElementById("locationInArrayPoints").disabled = false;
  document.getElementById("addWall").disabled = false;
  document.getElementById("changeWall").disabled = false;
  document.getElementById("deleteWall").disabled = false;
  document.getElementById("locationInArrayWalls").disabled = false;
  document.getElementById("deleteWalls").disabled = false;
  document.getElementById("distanceToleranceRange").disabled = false;
  document.getElementById("distanceToleranceInput").disabled = false;
  document.getElementById("wallHeightRange").disabled = false;
  document.getElementById("wallHeightInput").disabled = false;
  document.getElementById("wallThicknessRange").disabled = false;
  document.getElementById("wallThicknessInput").disabled = false;
  document.getElementById("constantSpeed").disabled = false;
  document.getElementById("showGridMap").disabled = false;
  document.getElementById("showMap").disabled = false;
  document.getElementById("positionGraph").disabled = false;
  document.getElementById("showLaserScan").disabled = false;
  document.getElementById("showMapLaserScan").disabled = false;
  document.getElementById("createMap").disabled = false;
  document.getElementById("createGridMap").disabled = false;
  document.getElementById("stopRobot").disabled = false;
  document.getElementById("goRobot").disabled = false;
  document.getElementById("importWalls").disabled = false;
  document.getElementById("wallArrayM").disabled = false;
  document.getElementById("selectOperationMode").disabled = false;
  document.getElementById("selectWallModel").disabled = false;

  document.getElementById("platformL").disabled = true;
  document.getElementById("platformS").disabled = true;
});

document.getElementById("platformL").addEventListener('click', function(){
  document.getElementById('xPositionInput').disabled = false;
  document.getElementById('yPositionInput').disabled = false;
  document.getElementById('thetaAngleInput').disabled = false;
  document.getElementById('wallPXSInput').disabled = false;
  document.getElementById('wallPYSInput').disabled = false;
  document.getElementById('wallPXEInput').disabled = false;
  document.getElementById('wallPYEInput').disabled = false;
  document.getElementById("xPositionRange").disabled = false;
  document.getElementById('yPositionRange').disabled = false;
  document.getElementById('thetaAngleRange').disabled = false;
  document.getElementById('wallPXSRange').disabled = false;
  document.getElementById('wallPYSRange').disabled = false;
  document.getElementById('wallPXERange').disabled = false;
  document.getElementById('wallPYERange').disabled = false;
  document.getElementById("addPoint").disabled = false;
  document.getElementById("switchRobotTrajectoryPoint").disabled = false;
  document.getElementById("changePoint").disabled = false;
  document.getElementById("deletePoint").disabled = false;
  document.getElementById("locationInArrayPoints").disabled = false;
  document.getElementById("addWall").disabled = false;
  document.getElementById("changeWall").disabled = false;
  document.getElementById("deleteWall").disabled = false;
  document.getElementById("locationInArrayWalls").disabled = false;
  document.getElementById("deleteWalls").disabled = false;
  document.getElementById("distanceToleranceRange").disabled = false;
  document.getElementById("distanceToleranceInput").disabled = false;
  document.getElementById("wallHeightRange").disabled = false;
  document.getElementById("wallHeightInput").disabled = false;
  document.getElementById("wallThicknessRange").disabled = false;
  document.getElementById("wallThicknessInput").disabled = false;
  document.getElementById("constantSpeed").disabled = false;
  document.getElementById("showGridMap").disabled = false;
  document.getElementById("showMap").disabled = false;
  document.getElementById("positionGraph").disabled = false;
  document.getElementById("showLaserScan").disabled = false;
  document.getElementById("showMapLaserScan").disabled = false;
  document.getElementById("createMap").disabled = false;
  document.getElementById("createGridMap").disabled = false;
  document.getElementById("stopRobot").disabled = false;
  document.getElementById("goRobot").disabled = false;
  document.getElementById("importWalls").disabled = false;
  document.getElementById("wallArrayM").disabled = false;
  document.getElementById("selectOperationMode").disabled = false;
  document.getElementById("selectWallModel").disabled = false;
  test_zoom = 1;
  xPositionRange.min = -500;
  xPositionRange.max = 500;
  xPositionRange.step = 1;
  xPositionRange.value = 0;
  xPositionInput.min = -500;
  xPositionInput.max = 500;
  xPositionInput.step = 1;
  xPositionInput.value = 0;
  yPositionRange.min = -500;
  yPositionRange.max = 500;
  yPositionRange.step = 1;
  yPositionRange.value = 0;
  yPositionInput.min = -500;
  yPositionInput.max = 500;
  yPositionInput.step = 1;
  yPositionInput.value = 0;
  thetaAngleRange.min = 0;
  thetaAngleRange.max = 360;
  thetaAngleRange.step = 1;
  thetaAngleRange.value = 0;
  thetaAngleInput.min = 0;
  thetaAngleInput.max = 360;
  thetaAngleInput.step = 1;
  thetaAngleInput.value = 0;
  wallPXSRange.min = -500;
  wallPXSRange.max = 500;
  wallPXSRange.step = 1;
  wallPXSRange.value = 0;
  wallPXSInput.min = -500;
  wallPXSInput.max = 500;
  wallPXSInput.step = 1;
  wallPXSInput.value = 0;
  wallPYSRange.min = -500;
  wallPYSRange.max = 500;
  wallPYSRange.step = 1;
  wallPYSRange.value = 0;
  wallPYSInput.min = -500;
  wallPYSInput.max = 500;
  wallPYSInput.step = 1;
  wallPYSInput.value = 0;
  wallPXERange.min = -500;
  wallPXERange.max = 500;
  wallPXERange.step = 1;
  wallPXERange.value = 0;
  wallPXEInput.min = -500;
  wallPXEInput.max = 500;
  wallPXEInput.step = 1;
  wallPXEInput.value = 0;
  wallPYERange.min = -500;
  wallPYERange.max = 500;
  wallPYERange.step = 1;
  wallPYERange.value = 0;
  wallPYEInput.min = -500;
  wallPYEInput.max = 500;
  wallPYEInput.step = 1;
  wallPYEInput.value = 0;
  document.getElementById("platformS").disabled = true;
  document.getElementById("platformL").disabled = true;
  viewer.scene.remove(grid3D);
  grid3D = new ROS3D.Grid({
    num_cells: 10,
    color: "#B0C9D9",
    cellSize: 1/test_zoom
  });
  viewer.addObject(grid3D);
});

xPositionRange.oninput = function() {
  var a = xPositionRange.value;
  xPositionInput.value = a;
}

xPositionInput.oninput = function() {
  var a = xPositionInput.value;
  xPositionRange.value = a;
}

yPositionRange.oninput = function() {
  var a = yPositionRange.value;
  yPositionInput.value = a;
}

yPositionInput.oninput = function() {
  var a = yPositionInput.value;
  yPositionRange.value = a;
}

thetaAngleRange.oninput = function() {
  var a = thetaAngleRange.value;
  thetaAngleInput.value = a;
}

thetaAngleInput.oninput = function() {
  var a = thetaAngleInput.value;
  thetaAngleRange.value = a;
}

distanceToleranceRange.oninput = function() {
  var a = distanceToleranceRange.value;
  distanceToleranceInput.value = a;
}

distanceToleranceInput.oninput = function() {
  var a = distanceToleranceInput.value;
  distanceToleranceRange.value = a;
}

wallPXSRange.oninput = function() {
  var a = wallPXSRange.value;
  wallPXSInput.value = a;
}

wallPXSInput.oninput = function() {
  var a = wallPXSInput.value;
  wallPXSRange.value = a;
}

wallPYSRange.oninput = function() {
  var a = wallPYSRange.value;
  wallPYSInput.value = a;
}

wallPYSInput.oninput = function() {
  var a = wallPYSInput.value;
  wallPYSRange.value = a;
}

wallPXERange.oninput = function() {
  var a = wallPXERange.value;
  wallPXEInput.value = a;
}

wallPXEInput.oninput = function() {
  var a = wallPXEInput.value;
  wallPXERange.value = a;
}

wallPYERange.oninput = function() {
  var a = wallPYERange.value;
  wallPYEInput.value = a;
}

wallPYEInput.oninput = function() {
  var a = wallPYEInput.value;
  wallPYERange.value = a;
}

wallHeightRange.oninput = function() {
  var a = wallHeightRange.value;
  wallHeightInput.value = a;
}

wallHeightInput.oninput = function() {
  var a = wallHeightInput.value;
  wallHeightRange.value = a;
}

wallThicknessRange.oninput = function() {
  var a = wallThicknessRange.value;
  wallThicknessInput.value = a;
}

wallThicknessInput.oninput = function() {
  var a = wallThicknessInput.value;
  wallThicknessRange.value = a;
}

var switchRobotTrajectoryPoint = document.getElementById("switchRobotTrajectoryPoint");
switchRobotTrajectoryPoint.addEventListener('change', function(){
  if(this.checked) {
    objectSelect = changeObject[1];
    document.getElementById("addPoint").disabled = false;
    if (objectSelect.length == 0) {
      locationInArrayPoints.value = "";
      locationInArrayPoints.max = 0;
    } else {
      locationInArrayPoints.value = objectSelect.length-1;
      locationInArrayPoints.max = objectSelect.length-1;
    }
  } else {
    objectSelect = changeObject[0];
    if (objectSelect.length == 1) {
      document.getElementById("addPoint").disabled = true;
      locationInArrayPoints.value = objectSelect.length-1;
      locationInArrayPoints.max = objectSelect.length-1;
    } else {
      locationInArrayPoints.value = "";
      locationInArrayPoints.max = 0;
    }
  }
});

var constantSpeed = 0;
document.getElementById("constantSpeed").addEventListener('change', function(){
  if(this.checked) {
    constantSpeed = 1;
  } else {
    constantSpeed = 0;
  }
});

var showGM = 0;
document.getElementById("showGridMap").addEventListener('change', function(){
  if(this.checked) {
    showGM = 1;
  } else {
    showGM = 0;
  }
});

var showM = 0;
document.getElementById("showMap").addEventListener('change', function(){
  if(this.checked) {
    showM = 1;
  } else {
    showM = 0;
  }
});

var showPG = 0;
document.getElementById("positionGraph").addEventListener('change', function(){
  if(this.checked) {
    showPG = 1;
  } else {
    showPG = 0;
  }
});

var locationInArrayPoints = document.getElementById("locationInArrayPoints");
locationInArrayPoints.min = 0;
locationInArrayPoints.max = 0;
locationInArrayPoints.step = 1;
locationInArrayPoints.value = "";

var addPoint = document.getElementById("addPoint");
addPoint.addEventListener('click', function(){
  if (objectSelect == changeObject[0]) {
    objectSelect.push(new TurtleBot(parseInt(xPositionInput.value), parseInt(yPositionInput.value), parseInt(thetaAngleInput.value), test_zoom));
    if (objectSelect.length == 1) {
      addPoint.disabled = true;
    }
  } else if (objectSelect == changeObject[1]) {
    objectSelect.push(new TrajectoryPoint(parseInt(xPositionInput.value), parseInt(yPositionInput.value), parseInt(thetaAngleInput.value), test_zoom));
  }
  if (objectSelect.length == 0) {
    locationInArrayPoints.value = "";
    locationInArrayPoints.max = 0;
  } else {
    locationInArrayPoints.value = objectSelect.length-1;
    locationInArrayPoints.max = objectSelect.length-1;
  }
});

var changePoint = document.getElementById("changePoint");
changePoint.addEventListener('click', function(){
  if (objectSelect == changeObject[0]) {
    if (locationInArrayPoints.value >= objectSelect.length || locationInArrayPoints.value < 0) {
    } else {
      objectSelect[locationInArrayPoints.value].tbX = convertCoordinateX(parseInt(xPositionInput.value), test_zoom);
      objectSelect[locationInArrayPoints.value].tbY = convertCoordinateY(parseInt(yPositionInput.value), test_zoom);
      objectSelect[locationInArrayPoints.value].tbTheta = parseInt(thetaAngleInput.value);
    }
  } else {
    if (locationInArrayPoints.value >= objectSelect.length || locationInArrayPoints.value < 0) {
    } else {
      objectSelect[locationInArrayPoints.value].tpX = convertCoordinateX(parseInt(xPositionInput.value), test_zoom);
      objectSelect[locationInArrayPoints.value].tpY = convertCoordinateY(parseInt(yPositionInput.value), test_zoom);
      objectSelect[locationInArrayPoints.value].tpTheta = parseInt(thetaAngleInput.value);
    }
  }
  if (objectSelect.length == 0) {
    locationInArrayPoints.value = "";
    locationInArrayPoints.max = 0;
  } else {
    locationInArrayPoints.value = objectSelect.length-1;
    locationInArrayPoints.max = objectSelect.length-1;
  }
});

var deletePoint = document.getElementById("deletePoint");
deletePoint.addEventListener('click', function(){
  if (locationInArrayPoints.value >= objectSelect.length || locationInArrayPoints.value < 0) {
  } else {
    objectSelect.splice(locationInArrayPoints.value, 1);
  }
  if (objectSelect.length == 0) {
    locationInArrayPoints.value = "";
    locationInArrayPoints.max = 0;
  } else {
    locationInArrayPoints.value = objectSelect.length-1;
    locationInArrayPoints.max = objectSelect.length-1;
  }
  if (objectSelect.length == 0 && objectSelect == changeObject[0]) {
    addPoint.disabled = false;
  }
});

var locationInArrayWalls = document.getElementById("locationInArrayWalls");
locationInArrayWalls.min = 0;
locationInArrayWalls.max = 0;
locationInArrayWalls.step = 1;
locationInArrayWalls.value = "";

var wallsMatrix = [];
var wI = wallsMatrix.length;

var addWall = document.getElementById("addWall");
addWall.addEventListener('click', function(){
  wallsMatrix.push([parseInt(wallPXSInput.value), parseInt(wallPYSInput.value), parseInt(wallPXEInput.value), parseInt(wallPYEInput.value), parseInt(wallHeightInput.value), parseInt(wallThicknessInput.value)]);
  createWall3D(wallsArray, walls3DArray, wallsMatrix[wallsMatrix.length-1][0], wallsMatrix[wallsMatrix.length-1][1], wallsMatrix[wallsMatrix.length-1][2],
                                         wallsMatrix[wallsMatrix.length-1][3], wallsMatrix[wallsMatrix.length-1][4], wallsMatrix[wallsMatrix.length-1][5], test_zoom);
  // Dodavanje 3D objekta sceni glavnog prikaza.
  viewer.selectableObjects.add(walls3DArray[walls3DArray.length-1]);
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

var changeWall = document.getElementById("changeWall");
changeWall.addEventListener('click', function(){
  if (locationInArrayWalls.value >= wallsMatrix.length || locationInArrayWalls.value < 0) {
  } else {
    wallsMatrix[locationInArrayWalls.value][0] = parseInt(wallPXSInput.value);
    wallsMatrix[locationInArrayWalls.value][1] = parseInt(wallPYSInput.value);
    wallsMatrix[locationInArrayWalls.value][2] = parseInt(wallPXEInput.value);
    wallsMatrix[locationInArrayWalls.value][3] = parseInt(wallPYEInput.value);
    wallsMatrix[locationInArrayWalls.value][4] = parseInt(wallHeightInput.value);
    wallsMatrix[locationInArrayWalls.value][5] = parseInt(wallThicknessInput.value);
    var wArray = [];
    var w3DArray = [];
    createWall3D(wArray, w3DArray, wallsMatrix[locationInArrayWalls.value][0], wallsMatrix[locationInArrayWalls.value][1], wallsMatrix[locationInArrayWalls.value][2],
                                           wallsMatrix[locationInArrayWalls.value][3], wallsMatrix[locationInArrayWalls.value][4], wallsMatrix[locationInArrayWalls.value][5], test_zoom);
    wallsArray.splice(locationInArrayWalls.value, 1, wArray[0]);
    walls3DArray.splice(locationInArrayWalls.value, 1, w3DArray[0]);
    viewer.selectableObjects.children.splice(locationInArrayWalls.value, 1, w3DArray[0]);
  }
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

var deleteWall = document.getElementById("deleteWall");
deleteWall.addEventListener('click', function(){
  if (locationInArrayWalls.value >= wallsMatrix.length || locationInArrayWalls.value < 0) {
  } else {
    wallsMatrix.splice(locationInArrayWalls.value, 1);
    wallsArray.splice(locationInArrayWalls.value, 1);
    walls3DArray.splice(locationInArrayWalls.value, 1);
    viewer.selectableObjects.children.splice(locationInArrayWalls.value, 1);
  }
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

var deleteWalls = document.getElementById("deleteWalls");
deleteWalls.addEventListener('click', function(){
  wallsMatrix = [];
  wallsArray = [];
  walls3DArray = [];
  viewer.selectableObjects.children = [];
  document.getElementById("selectWallOption").selected = "true";
  wI = wallsMatrix.length;
  if (wallsMatrix.length == 0) {
    locationInArrayWalls.value = "";
    locationInArrayWalls.max = 0;
  } else {
    locationInArrayWalls.value = wallsMatrix.length-1;
    locationInArrayWalls.max = wallsMatrix.length-1;
  }
});

function displayCanvasWalls () {
  var textArrayElement = "";
  for (var i = 0; i < wallsMatrix.length; i++) {
    if (i != wallsMatrix.length-1) {
      textArrayElement += ("[" + wallsMatrix[i][0] + ", " + wallsMatrix[i][1] + ", " + wallsMatrix[i][2] + ", " + wallsMatrix[i][3] + ", " + wallsMatrix[i][4] + ", " + wallsMatrix[i][5] + "], ").toString();
    } else {
      textArrayElement += ("[" + wallsMatrix[i][0] + ", " + wallsMatrix[i][1] + ", " + wallsMatrix[i][2] + ", " + wallsMatrix[i][3] + ", " + wallsMatrix[i][4] + ", " + wallsMatrix[i][5] + "]").toString();
    }
  }
  if (wallsMatrix.length == 0) {
    document.getElementById("wallArrayMDisplay").value = "";
  } else {
    document.getElementById("wallArrayMDisplay").value = "["+textArrayElement+"]";
  }
}

// Promenljiva koja čuva offset poziciju canvas elementa u odnosu na prozor pretraživača.
var offsetX = BB.left;
var offsetY = BB.top;

// Funkcija za izračunavanje nove offset pozicije canvas elementa.
function reOffset(){
  var BB = canvas.getBoundingClientRect();
  offsetX = BB.left;
  offsetY = BB.top;
}

// Osluškivanje detekcije događaja promene dimenzije prozora pretraživača i događaja skrolovanja, i primena funkcije ukoliko je događaj detektovan.
window.onscroll = function(event){
  reOffset();
}
window.onresize = function(event){
  reOffset();
}

function convertCoordinateX(x, zoom){ //x u Gazebo ravni u [cm]
  if (zoom == 1) {
    x = x/2+250; //konvertovanje npr (0 do 500) [cm] u (250 do 500) [px]
  } else {
    x = x+250; //konvertovanje npr (0 do 250) [cm] u (250 do 500) [px]
  }
  return x; //x u [px]
}

function displayCoordinateX(x, zoom){ //x u [px]
  if (zoom == 1) {
    x = x*2-250*2;
  } else {
    x = x-250;
  }
  return x; //x u [cm]
}

function convertCoordinateY(y, zoom){ //y u Gazebo ravni u [cm]
  if (zoom ==1) {
    y = 250-y/2; //konvertovanje npr (0 do -500) [cm] u (250 do 500) [px]
  } else {
    y = 250-y; //konvertovanje npr (0 do -250) [cm] u (250 do 500) [px]
  }
  return y; //y u [px]
}

function displayCoordinateY(y, zoom){ //y u [px]
  if (zoom ==1) {
    y = 250*2-y*2;
  } else {
    y = 250-y;
  }
  return y; //y u [cm]
}

function lengthD (dX, zoom) {
  if (zoom == 1) {
    dX = dX/2;
  } else {
    dX = dX;
  }
  return dX;
}

//x i y ose
function robotGrid() {
    for (var i = 0; i <=500; i += 50) {
      context.beginPath();
      context.moveTo(0,i);
      context.lineTo(500,i);
      context.strokeStyle = "#B0C9D9";
      context.stroke();
      context.beginPath();
      context.moveTo(i,0);
      context.lineTo(i,500);
      context.strokeStyle = "#B0C9D9";
      context.stroke();
    }
}

function euclideanDistance(objectA, objectB, zoom) {
  return math.sqrt(math.pow(cmToM(displayCoordinateX(objectB.tpX, zoom)) - objectA.posePointPositionX, 2)+math.pow(cmToM(displayCoordinateY(objectB.tpY, zoom)) - objectA.posePointPositionY, 2));
}
function steeringAngle(objectA, objectB, zoom) {
  return math.atan2(cmToM(displayCoordinateY(objectB.tpY, zoom)) - objectA.posePointPositionY, cmToM(displayCoordinateX(objectB.tpX, zoom)) - objectA.posePointPositionX);
}
function encoder (odometryData, eulerFromQuaternion, trajectoryPoint, zoom) {
  var x = odometryData.posePointPositionX;
  var y = odometryData.posePointPositionY;
  var theta = eulerFromQuaternion;
  var constantRo=0.066/2;
  var constantAlphaBeta=0.066/(2*0.080);
  // vrednost constantAlphaBeta dobijena je deljenjem precnika tocka robota sa dvostrukom vrednoscu polovine distance izmedju tockova robota, ukupna distanca izmedju tockova robota je 160mm
  // dimenzije robota turtlebot3 model burger koriscene pri racunanju vrednosti constantRo i constantAlphaBeta preuzete su sa sajta http://emanual.robotis.com/docs/en/platform/turtlebot3/specifications/#dimension-and-mass
  var sA = steeringAngle(odometryData, trajectoryPoint, zoom);
  var eD = euclideanDistance(odometryData, trajectoryPoint, zoom);
  // var alpha0 = (sA-theta+math.PI) % (2*math.PI) - math.PI;
  var kr = constantRo;
  var alpha = (sA-theta+math.PI) % (2*math.PI) - math.PI;
  var beta = (THREE.Math.degToRad(trajectoryPoint.tpTheta)-sA+math.PI) % (2*math.PI) - math.PI;
  // normalizacija ugla, svodjenje na vrednost iz opsega [-pi, pi)
  var velocity = kr * eD;
  var omega = constantAlphaBeta * alpha + (-constantAlphaBeta) * beta;
  // Maksimalna brzina translacije: 0.22 m/s
  // Maksimalna brzina rotacije: 2.84 rad/s (162.72 deg/s)
  if (constantSpeed == 1) {
    velocity = velocity*3;
    omega = omega*3;
  }
  if ((eD < cmToM(distanceToleranceInput.value)) && (trajectoryPointsArray.length-1 == index)) {
    encoderON = 0;
    linebasedEKFON = 0;
    ekfSLAMON = 0;
    aStarPSAON = 0;
  	velocity = 0;
    omega = 0;
  }
  return [velocity, omega];
}

function WallBuilder (wStartX, wStartY, wEndX, wEndY, wH, wT, wZoom) {
  this.wStartX = wStartX;
  this.wStartY = wStartY;
  this.wEndX = wEndX;
  this.wEndY = wEndY;
  this.wH = wH;
  this.wT = wT;
  this.wZoom = wZoom;
  this.updateWallBuilder = function (wStartX, wStartY, wEndX, wEndY, wH, wT, wZoom) {
    this.wStartX = wStartX;
    this.wStartY = wStartY;
    this.wEndX = wEndX;
    this.wEndY = wEndY;
    this.wH = wH;
    this.wT = wT;
    this.wZoom = wZoom;
  }
  this.createWall = function (wZoom) {
    this.wZoom = wZoom;
    if (this.wStartX != this.wEndX && this.wStartY != this.wEndY) {
      var cX = 0;
      var cY = 0;
      var xP = 0;
      var yP = 0;
      var wAngle = 0;
      var wL = 0;
      var wW = 0;
      if (this.wStartX < this.wEndX && this.wStartY > this.wEndY) {
        cX = this.wStartX+math.abs(this.wEndX-this.wStartX)/2;
        cY = this.wStartY-math.abs(this.wEndY-this.wStartY)/2;
      } else if (this.wStartX < this.wEndX && this.wStartY < this.wEndY) {
        cX = this.wStartX+math.abs(this.wEndX-this.wStartX)/2;
        cY = this.wStartY+math.abs(this.wEndY-this.wStartY)/2;
      } else if (this.wStartX > this.wEndX && this.wStartY > this.wEndY) {
        cX = this.wStartX-math.abs(this.wEndX-this.wStartX)/2;
        cY = this.wStartY-math.abs(this.wEndY-this.wStartY)/2;
      } else if (this.wStartX > this.wEndX && this.wStartY < this.wEndY) {
        cX = this.wStartX-math.abs(this.wEndX-this.wStartX)/2;
        cY = this.wStartY+math.abs(this.wEndY-this.wStartY)/2;
      }
      xP = convertCoordinateX(cX-this.wT/2-math.sqrt(math.pow((cX-this.wStartX),2)+math.pow((cY-this.wStartY), 2)), this.wZoom);
      yP = convertCoordinateY(cY+this.wT/2, this.wZoom);
      wAngle = -math.atan2((this.wEndY-this.wStartY), (this.wEndX-this.wStartX));
      wL = lengthD(math.sqrt(math.pow((cX-this.wStartX),2)+math.pow((cY-this.wStartY), 2))*2+this.wT, this.wZoom);;
      wW = lengthD(this.wT, this.wZoom);
      context.save();
      context.translate(xP+wL/2, yP+wW/2);
      context.rotate(wAngle);
      context.fillStyle = "#996633";
      context.fillRect(-wL/2, -wW/2, wL, wW);
      context.restore();
    } else if (this.wStartX == this.wEndX || this.wStartY == this.wEndY) {
      var xP = 0;
      var yP = 0;
      var wL = 0;
      var wW = 0;
      if (this.wStartY == this.wEndY) {
        yP = convertCoordinateY(this.wStartY+this.wT/2, this.wZoom);
        if (this.wStartX < this.wEndX) {
          xP = convertCoordinateX(this.wStartX-this.wT/2, this.wZoom);
        } else {
          xP = convertCoordinateX(this.wEndX-this.wT/2, this.wZoom);
        }
        wL = lengthD(math.abs(this.wEndX-this.wStartX)+this.wT, this.wZoom);
        wW = lengthD(this.wT, this.wZoom);
      } else {
        xP = convertCoordinateX(this.wStartX-this.wT/2, this.wZoom);
        if (this.wStartY > this.wEndY) {
          yP = convertCoordinateY(this.wStartY+this.wT/2, this.wZoom);
        } else {
          yP = convertCoordinateY(this.wEndY+this.wT/2, this.wZoom);
        }
        wL = lengthD(this.wT, this.wZoom);
        wW = lengthD(math.abs(this.wEndY-this.wStartY)+this.wT, this.wZoom);
      }
      context.fillStyle = "#996633";
      context.fillRect(xP, yP, wL, wW);
    }
  }
}

var wallsArray =[];
var walls3DArray = [];
var wallStartPointX = 0;
var wallStartPointY = 0;
var wallEndPointX = 0;
var wallEndPointY = 0;
var wallHeight = 0;
var wallThickness = 0;
function createWall3D(wArray, w3DArray, wStartX, wStartY, wEndX, wEndY, wH, wT, wZoom) {
  wArray.push(new WallBuilder(wStartX, wStartY, wEndX, wEndY, wH, wT, wZoom));
  var wL = 0;
  var wW = 0;
  var wPX = 0;
  var wPY = 0;
  var wAngle = 0;
  wL = math.sqrt(math.pow((wEndX-wStartX),2)+math.pow((wEndY-wStartY), 2)) + wT;
  wW = wT;
  if (wStartX < wEndX && wStartY > wEndY) {
    wPX = wStartX+(math.abs(wEndX-wStartX)/2);
    wPY = wStartY-(math.abs(wEndY-wStartY)/2);
  } else if (wStartX < wEndX && wStartY < wEndY) {
    wPX = wStartX+math.abs(wEndX-wStartX)/2;
    wPY = wStartY+math.abs(wEndY-wStartY)/2;
  } else if (wStartX > wEndX && wStartY > wEndY) {
    wPX = wStartX-math.abs(wEndX-wStartX)/2;
    wPY = wStartY-math.abs(wEndY-wStartY)/2;
  } else if (wStartX > wEndX && wStartY < wEndY) {
    wPX = wStartX-math.abs(wEndX-wStartX)/2;
    wPY = wStartY+math.abs(wEndY-wStartY)/2;
  } else if (wStartX == wEndX || wStartY == wEndY) {
    if (wStartY == wEndY) {
      wPY = wStartY;
      if (wStartX < wEndX) {
        wPX = wStartX+(math.abs(wEndX-wStartX)/2);
      } else {
        wPX = wStartX-math.abs(wEndX-wStartX)/2;
      }
    } else {
      wPX = wStartX;
      if (wStartY > wEndY) {
        wPY = wStartY-(math.abs(wEndY-wStartY)/2);
      } else {
        wPY = wStartY+math.abs(wEndY-wStartY)/2;
      }
    }
  }
  wAngle = math.atan2((wEndY-wStartY), (wEndX-wStartX));
  var geometry = new THREE.BoxBufferGeometry(cmToM(wL), cmToM(wW), cmToM(wH));
  var material = new THREE.MeshStandardMaterial( { color: 0x996633 } );
  var mesh = new THREE.Mesh( geometry, material );
  mesh.position.set(cmToM(wPX), cmToM(wPY), cmToM(wH/2));
  mesh.rotation.set(0, 0, wAngle);
  w3DArray.push(mesh);
}

var robotPosesCompare = [];
var laserScanArray = [];

function mean (numbers) {
    var total = 0, i;
    for (i = 0; i < numbers.length; i += 1) {
        total += numbers[i];
    }
    return total / numbers.length;
}
function scalarArrayMultiply (scalar, array) {
  var result = [];
  for(var i=0; i<array.length; i++) {
  	result.push(scalar*array[i]);
  }
  return result;
}
function scalarArrayAddition (scalar, array) {
  var result = [];
  for(var i=0; i<array.length; i++) {
  	result.push(scalar+array[i]);
  }
  return result;
}
function arrayArrayAddition (array1, array2) {
  var result = [];
  for(var i=0; i<array1.length; i++) {
    result.push(array1[i]+array2[i]);
  }
  return result;
}

function getDataFromLaserScan (laserScanArrayElement) {
  var ro = [];
  var theta = [];
  var x = [];
  var y = [];
  var step = 0;
  for (var i = 0; i < laserScanArrayElement[0].ranges.length; i++) {
    if (laserScanArrayElement[0].ranges[i] != null) {
      ro.push(laserScanArrayElement[0].ranges[i]);
      theta.push(laserScanArrayElement[0].angleMin+step);
      x.push(laserScanArrayElement[0].ranges[i]*math.cos(laserScanArrayElement[0].angleMin+step));
      y.push(laserScanArrayElement[0].ranges[i]*math.sin(laserScanArrayElement[0].angleMin+step));
      step += laserScanArrayElement[0].angleIncrement;
    } else {
      step += laserScanArrayElement[0].angleIncrement;
    }
  }
  return [ro, theta, x, y];
}

function getDataFromLaserScanUpdated (laserScanArrayElement) {
  var ro = [];
  var theta = [];
  var x = [];
  var y = [];
  var step = 0;
  for (var i = 0; i < laserScanArrayElement[0].ranges.length; i++) {
    if (laserScanArrayElement[0].ranges[i] != null) {
      ro.push(laserScanArrayElement[0].ranges[i]);
      theta.push(laserScanArrayElement[0].angleMin+laserScanArrayElement[3]+step);
      x.push(laserScanArrayElement[1]-0.0345*math.cos(laserScanArrayElement[3])+laserScanArrayElement[0].ranges[i]*math.cos(laserScanArrayElement[0].angleMin+laserScanArrayElement[3]+step));
      y.push(laserScanArrayElement[2]-0.0345*math.sin(laserScanArrayElement[3])+laserScanArrayElement[0].ranges[i]*math.sin(laserScanArrayElement[0].angleMin+laserScanArrayElement[3]+step));
      step += laserScanArrayElement[0].angleIncrement;
    } else {
      step += laserScanArrayElement[0].angleIncrement;
    }
  }
  return [ro, theta, x, y];
}

function mapGeneratorSplit (mArray, dataArray) {
  var sum1 = 0;
  var sum2 = 0;
  var xc = math.mean(dataArray[2]);
  var yc = math.mean(dataArray[3]);
  for (var i = 0; i < dataArray[2].length; i++) {
    sum1 = sum1 + (yc-dataArray[3][i])*(xc-dataArray[2][i]);
    sum2 = sum2 + math.pow((yc-dataArray[3][i]), 2)-math.pow((xc-dataArray[2][i]), 2);
  }
  var alpha = 0.5*math.atan2(-2*sum1, sum2);
  var r = xc*math.cos(alpha)+yc*math.sin(alpha);
  if (r < 0) {
    alpha = alpha+math.PI;
    if (alpha > math.PI) {
      alpha = alpha-2*math.PI;
    }
    r = -r;
  }
  var dArray = [];
  for (var i = 0; i < dataArray[0].length; i++) {
    dArray.push(dataArray[3][i]*math.sin(alpha)+dataArray[2][i]*math.cos(alpha)-r);
  }
  var d = math.max(...dArray);
  var ind = dArray.indexOf(d);
  if (d > 0.05) {
      if ((ind+1 != dataArray[2].length) && (ind != 0)) {
        mapGeneratorSplit(mArray, [dataArray[0].slice(0, ind+1), dataArray[1].slice(0, ind+1), dataArray[2].slice(0, ind+1), dataArray[3].slice(0, ind+1)]);
        mapGeneratorSplit(mArray, [dataArray[0].slice(ind), dataArray[1].slice(ind), dataArray[2].slice(ind), dataArray[3].slice(ind)]);
      } else if (ind == 0) {
        mapGeneratorSplit(mArray, [dataArray[0].slice(0, 2), dataArray[1].slice(0, 2), dataArray[2].slice(0, 2), dataArray[3].slice(0, 2)]);
        mapGeneratorSplit(mArray, [dataArray[0].slice(1), dataArray[1].slice(1), dataArray[2].slice(1), dataArray[3].slice(1)]);
      } else {
        mapGeneratorSplit(mArray, [dataArray[0].slice(0, -1), dataArray[1].slice(0, -1), dataArray[2].slice(0, -1), dataArray[3].slice(0, -1)]);
        mapGeneratorSplit(mArray, [dataArray[0].slice(-2), dataArray[1].slice(-2), dataArray[2].slice(-2), dataArray[3].slice(-2)]);
      }
  } else {
    mArray.push([r, alpha, dataArray[0], dataArray[1], dataArray[2], dataArray[3], -1/math.tan(alpha), r/math.sin(alpha)]);
  }
}
function mapGeneratorSplitWrapper (dataFLS) {
  var array = [];
  mapGeneratorSplit(array, dataFLS);
  return array;
}

function mapGeneratorMerge (mArray) {
  var mArraySorted = [];
  var j = 0;
  var array = [];
  mArraySorted.push(mArray[0]);
  mArray.shift();
  while (mArray.length != 0) {
    for (var i = 0; i < mArray.length; i++) {
      var lastFirst = (mArraySorted[j][4][mArraySorted[j][4].length-1] == mArray[i][4][0]) && (mArraySorted[j][5][mArraySorted[j][5].length-1] == mArray[i][5][0]);
      var firstLast = (mArraySorted[j][4][0] == mArray[i][4][mArray[i][4].length-1]) && (mArraySorted[j][5][0] == mArray[i][5][mArray[i][5].length-1]);
      var aX = math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0]), 2))*
      math.cos(mArray[i][1]-math.asin(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0])/
      math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0]), 2))));
      var aY = math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0]), 2))*
      math.sin(mArray[i][1]-math.asin(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0])/
      math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][0]*math.sin(mArray[i][1]-mArray[i][3][0]), 2))));
      var bX = math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1]), 2))*
      math.cos(mArray[i][1]-math.asin(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1])/
      math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1]), 2))));
      var bY = math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1]), 2))*
      math.sin(mArray[i][1]-math.asin(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1])/
      math.sqrt(math.pow(mArray[i][0], 2)+math.pow(mArray[i][2][mArray[i][2].length-1]*math.sin(mArray[i][1]-mArray[i][3][mArray[i][3].length-1]), 2))));
      var cX = math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0]), 2))*
      math.cos(mArraySorted[j][1]-math.asin(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0])/
      math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0]), 2))));
      var cY = math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0]), 2))*
      math.sin(mArraySorted[j][1]-math.asin(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0])/
      math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][0]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][0]), 2))));
      var dX = math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1]), 2))*
      math.cos(mArraySorted[j][1]-math.asin(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1])/
      math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1]), 2))));
      var dY = math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1]), 2))*
      math.sin(mArraySorted[j][1]-math.asin(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1])/
      math.sqrt(math.pow(mArraySorted[j][0], 2)+math.pow(mArraySorted[j][2][mArraySorted[j][2].length-1]*math.sin(mArraySorted[j][1]-mArraySorted[j][3][mArraySorted[j][3].length-1]), 2))));
      if (math.abs((aX*(bY-cY)+bX*(cY-aY)+cX*(aY-bY))/2) <= 0.005 && math.abs((aX*(bY-dY)+bX*(dY-aY)+dX*(aY-bY))/2) <= 0.005 && (lastFirst || firstLast)) {
        for (var k = 0; k < mArray[i][2].length; k++) {
          mArraySorted[j][2].push(mArray[i][2][k]);
          mArraySorted[j][3].push(mArray[i][3][k]);
          mArraySorted[j][4].push(mArray[i][4][k]);
          mArraySorted[j][5].push(mArray[i][5][k]);
        }
        var sum1 = 0;
        var sum2 = 0;
        var xc = math.mean(mArraySorted[j][4]);
        var yc = math.mean(mArraySorted[j][5]);
        for (var k = 0; k < mArraySorted[j][2].length; k++) {
          sum1 = sum1 + (yc-mArraySorted[j][5][k])*(xc-mArraySorted[j][4][k]);
          sum2 = sum2 + math.pow((yc-mArraySorted[j][5][k]), 2)-math.pow((xc-mArraySorted[j][4][k]), 2);
        }
        var alpha = 0.5*math.atan2(-2*sum1, sum2);
        var r = xc*math.cos(alpha)+yc*math.sin(alpha);
        if (r < 0) {
          alpha = alpha+math.PI;
          if (alpha > math.PI) {
            alpha = alpha-2*math.PI;
          }
          r = -r;
        }
        mArraySorted[j][0] = r;
        mArraySorted[j][1] = alpha;
        mArraySorted[j][6] = -1/math.tan(alpha);
        mArraySorted[j][7] = r/math.sin(alpha);
      } else {
        array.push(mArray[i]);
      }
    }
    mArray = array;
    array = [];
    j += 1;
    if (mArray.length != 0) {
      mArraySorted.push(mArray[0]);
      mArray.shift();
    }
  }
  mArray = mArraySorted;
  return mArray;
}

function scalarMultiplyMatrixNxM (scalar, array) {
  var arrayRowCount = array.length;
  var arrayColumnCount = array[0].length;
  var result = array;
  for (var i = 0; i < arrayRowCount; i++) {
    for (var j = 0; j < arrayColumnCount; j++) {
      result[i][j] = scalar*array[i][j];
    }
  }
  return result;
}

function matrixNxMAddition (array1, array2) {
  if ((array1.length == array2.length) && (array1[0].length == array2[0].length)) {
    var arrayRowCount = array1.length;
    var arrayColumnCount = array1[0].length;
    var result = array1;
    for (var i = 0; i < arrayRowCount; i++) {
      for (var j = 0; j < arrayColumnCount; j++) {
        result[i][j] = array1[i][j]+array2[i][j];
      }
    }
    return result;
  } else {
    return NaN;
  }
}

function zeroArray1xN (elementCount) {
  var result = [];
  for (var i = 0; i < elementCount; i++) {
    result.push(0);
  }
  return result;
}

function zeroMatrixNxM (rowCount, columnCount) {
  var result = [];
  for (var i = 0; i < rowCount; i++) {
    result.push(zeroArray1xN(columnCount));
  }
  return result;
}

function multiplyMatrixNxM (array1, array2) {
  if (array1[0].length == array2.length) {
    var result = [];
    for (var i = 0; i < array1.length; i++) {
      result.push(zeroArray1xN(array2[0].length));
      for (var j = 0; j < array2[0].length; j++) {
        result[i][j] = 0;
        for (var k = 0; k < array1[0].length; k++) {
          result[i][j] += array1[i][k]*array2[k][j];
        }
      }
    }
    return result;
  } else {
    return NaN;
  }
}

function matrixTranspose (array) {
  var rowCount = array.length;
  if (rowCount != 0) {
    var columnCount = array[0].length;
    var result = [];
    for (var i = 0; i < columnCount; i++) {
      result.push(zeroArray1xN(rowCount));
      for (var j = 0; j < rowCount; j++) {
        result[i][j] = array[j][i];
      }
    }
    return result;
  } else {
    return NaN;
  }
}

function identityMatrixNxN (size) {
  var result = [];
  for (var i = 0; i < size; i++) {
    result.push(zeroArray1xN(size));
    result[i][i] = 1;
  }
  return result;
}

var sigmaRoDistanceSqr = 1;
var sigmathetaAngleSqr = 1;
function mapGeneratorMeasurementNoiseCovariance (mArray) {
  for (var i = 0; i < mArray.length; i++) {
    var pUk = [];
    var deltaRoDistanceK = [];
    var pDeltaRoDistanceK = [];
    var phiK = [];
    var sum3 = 0;
    var sum4 = 0;
    var phiP = 0;
    var deltaPhiK=[];
    var sum5 = 0;
    var sum6 = 0;
    var sum7 = 0;
    var sum8 = 0;
    var deltaAlpha = 0;
    var pAlphaAlpha = 0;
    var pRoRo = 0;
    var pRoAplha = 0;
    var ro = 0;
    var aplha = 0;
    var mR = [[0, 0], [0, 0]];
    for (var j = 0; j < mArray[i][2].length; j++) {
      pUk.push(math.add(math.multiply((math.pow(mArray[i][2][j], 2)*sigmathetaAngleSqr)/2, [[2*math.pow(math.sin(mArray[i][3][j]), 2),
       -1*math.sin(2*mArray[i][3][j])], [-1*math.sin(2*mArray[i][3][j]), 2*math.pow(math.cos(mArray[i][3][j]), 2)]]),
        math.multiply(sigmaRoDistanceSqr/2, [[2*math.pow(math.cos(mArray[i][3][j]), 2),    math.sin(2*mArray[i][3][j])],
        [   math.sin(2*mArray[i][3][j]), 2*math.pow(math.sin(mArray[i][3][j]), 2)]])));

      deltaRoDistanceK.push(mArray[i][5][j]*math.sin(mArray[i][1])+mArray[i][4][j]*math.cos(mArray[i][1])-mArray[i][0]);

      pDeltaRoDistanceK.push(math.multiply([[math.cos(mArray[i][1]), math.sin(mArray[i][1])]], math.multiply(pUk[j], math.transpose([[math.cos(mArray[i][1]), math.sin(mArray[i][1])]]))));
      phiK.push(mArray[i][2][j]*math.sin(mArray[i][1]-mArray[i][3][j]));

      sum3 += (mArray[i][5][j]*math.sin(mArray[i][1])+mArray[i][4][j]*math.cos(mArray[i][1]))/pDeltaRoDistanceK[j];

      sum4 += phiK[j]/pDeltaRoDistanceK[j];
      sum5 += 1/pDeltaRoDistanceK[j];
    }
    phiP = sum4/sum5;
    for (var j = 0; j < mArray[i][2].length; j++) {
      deltaPhiK.push(phiK[j]-phiP);
      sum6 += (deltaPhiK[j]*deltaRoDistanceK[j])/pDeltaRoDistanceK[j];
      sum7 += math.pow(deltaPhiK[j], 2)/pDeltaRoDistanceK[j];
      sum8 += deltaPhiK[j]/pDeltaRoDistanceK[j];
    }
    deltaAlpha = -(sum6/sum7);
    pAlphaAlpha = 1/sum7;
    pRoRo = 1/sum5;
    pRoAlpha = -pAlphaAlpha*pRoRo*sum8;
    ro = sum3/sum5;
    alpha = mArray[i][1]+deltaAlpha;
    if (ro < 0) {
      alpha = alpha+math.PI;
      if (alpha > math.PI) {
        alpha = alpha-2*math.PI;
      }
      ro = -ro;
    }
    mR = [[pAlphaAlpha, pRoAlpha], [pRoAlpha, pRoRo]];
    mArray[i][0] = ro;
    mArray[i][1] = alpha;
    mArray[i][6] = -1/math.tan(alpha);
    mArray[i][7] = ro/math.sin(alpha);
    mArray[i].push(mR);
  }
  return mArray;
}

function mapGeneratorDrawMap (mArray, color, zoom) {
  for (var i = 0; i < mArray.length; i++) {
    var points = [];
    var s = [0, mArray[i][2].length-1];
    for (var k = 0; k < 2; k++) {
      var j = s[k];
      var xL = mArray[i][0]*math.cos(mArray[i][1]);
      var yL = mArray[i][0]*math.sin(mArray[i][1]);
      var xP = (mArray[i][0]+(mArray[i][5][j]*math.sin(mArray[i][1])+mArray[i][4][j]*math.cos(mArray[i][1])-mArray[i][0]))*math.cos(mArray[i][1]);
      var yP = (mArray[i][0]+(mArray[i][5][j]*math.sin(mArray[i][1])+mArray[i][4][j]*math.cos(mArray[i][1])-mArray[i][0]))*math.sin(mArray[i][1]);
      var dX = math.abs(xP-mArray[i][4][j])
      var dY = math.abs(yP-mArray[i][5][j])
      if (xP < mArray[i][4][j]) {
        var x = xL+dX;
        if (yP > mArray[i][5][j]) {
          var y = yL-dY;
        } else if (yP < mArray[i][5][j]) {
          var y = yL+dY;
        }
      } else if (xP > mArray[i][4][j]) {
        var x = xL-dX;
        if (yP > mArray[i][5][j]) {
          var y = yL-dY;
        } else if (yP < mArray[i][5][j]) {
          var y = yL+dY;
        }
      }
      points.push([x, y]);
    }
    context.beginPath();
    context.moveTo(convertCoordinateX(mToCm(points[0][0]), zoom), convertCoordinateY(mToCm(points[0][1]), zoom));
    context.lineTo(convertCoordinateX(mToCm(points[1][0]), zoom), convertCoordinateY(mToCm(points[1][1]), zoom));
    context.strokeStyle = color;
    context.stroke();
  }
}

function mapFilter (mArray) {
  var filter = [];
  for (var i = 0; i < mArray.length; i++) {
    if (mArray[i][2].length > 9) {
      filter.push(mArray[i]);
    }
  }
  return filter;
}

var brojLBEKF = 0; //Informacija o broju mV != [] iteracija
var dSr = [];
var dSl = [];
var mFArray = [];
var mPArray = [math.multiply(0.01, [[1, 0, 0], [0, 1, 0], [0, 0, 1]])];
var linebasedEKFInit = 1;
function linebasedEKF (robotOdometry, robotAngle, robotJointStates, mapLaserScan, map, trajectoryGoalPoint, zoom) {
  var b = 0.16;
  var k = 0.9;
  var g = 1;
  if (linebasedEKFInit == 1) {
    dSr.push(robotJointStates.wheelRightJoint*0.033);
    dSl.push(robotJointStates.wheelLeftJoint*0.033);
    mFArray.push([[robotOdometry.posePointPositionX], [robotOdometry.posePointPositionY], [robotAngle]]);
    linebasedEKFInit = 0;
  }
  // Predikcija
  dSr.push(robotJointStates.wheelRightJoint*0.033); //računa se kao dužina luka
  dSl.push(robotJointStates.wheelLeftJoint*0.033);
  var dS = ((dSr[dSr.length-1]-dSr[dSr.length-2])+(dSl[dSl.length-1]-dSl[dSl.length-2]))/2;
  var dTheta = ((dSr[dSr.length-1]-dSr[dSr.length-2])-(dSl[dSl.length-1]-dSl[dSl.length-2]))/b;
  var mQ = math.multiply(k, [[math.abs(dSl[dSl.length-1]-dSl[dSl.length-2]), 0], [0, math.abs(dSr[dSr.length-1]-dSr[dSr.length-2])]]);
  var mF = math.add(mFArray[mFArray.length-1], [[dS*math.cos(robotAngle+dTheta/2)], [dS*math.sin(robotAngle+dTheta/2)], [dTheta]]);
  var mFx = [[1, 0, -dS*math.sin(robotAngle-dTheta/2)], [0, 1, dS*math.cos(robotAngle-dTheta/2)], [0, 0, 1]];
  var mFu = [[math.cos(robotAngle-dTheta/2)/2+dS*math.sin(robotAngle-dTheta/2)/(2*b), math.cos(robotAngle-dTheta/2)/2-dS*math.sin(robotAngle-dTheta/2)/(2*b)],
         [math.sin(robotAngle-dTheta/2)/2-dS*math.cos(robotAngle-dTheta/2)/(2*b), math.sin(robotAngle-dTheta/2)/2+dS*math.cos(robotAngle-dTheta/2)/(2*b)],
         [-1/b, 1/b]];
  var mP = math.add(math.multiply(mFx, math.multiply(mPArray[mPArray.length-1], math.transpose(mFx))), math.multiply(mFu, math.multiply(mQ, math.transpose(mFu))));
  // Opservacija i pridruzivanje merenja
  var mV = [];
  var mH = [];
  var mRArray = [];
  for (var i = 0; i < mapLaserScan.length; i++) {
    var zj = [[mapLaserScan[i][1]], [mapLaserScan[i][0]]];
    var deltaHArray = [];
    var vijArray = [];
    var pmRArray = [];
    var mahalanobisArray =[];
    for (var j = 0; j < map.length; j++) {
      var zi = [[map[j][1]-mF[2][0]], [map[j][0]-(mF[0][0]*math.cos(map[j][1])+mF[1][0]*math.sin(map[j][1]))]];
      var deltaH = [[0, 0, -1], [-math.cos(map[j][1]), -math.sin(map[j][1]), 0]];
      if (zi[1][0] < 0) {
        zi[0][0] = zi[0][0]+math.PI;
        zi[1][0] = -zi[1][0];
        deltaH[1] = math.multiply(-1, deltaH[1]);
      }
      if (zi[0][0] > math.PI) {
        zi[0][0] = zi[0][0]-2*math.PI;
      } else if (zi[0][0] < -math.PI) {
        zi[0][0] = zi[0][0]+2*math.PI;
      }
      var vij = math.subtract(zj, zi);
      var sigmaINij = math.add(math.multiply(deltaH, math.multiply(mP, math.transpose(deltaH))), mapLaserScan[i][8]);
      var mahalanobis = math.multiply(math.transpose(vij), math.multiply(math.inv(sigmaINij), vij));
      deltaHArray.push(deltaH);
      vijArray.push(vij);
      pmRArray.push(mapLaserScan[i][8]);
      mahalanobisArray.push(mahalanobis[0][0]);
    }
    var aIndex = mahalanobisArray.indexOf(math.min(mahalanobisArray));
    if (math.abs(mahalanobisArray[aIndex]) <= 0.005) {
      mH.push(deltaHArray[aIndex][0]);
      mH.push(deltaHArray[aIndex][1]);
      mV.push(vijArray[aIndex][0]);
      mV.push(vijArray[aIndex][1]);
      mRArray.push(pmRArray[aIndex]);
    }
  }
  if (mV.length == 0) {
    mFArray.push(mF);
    mPArray.push(mP);
    var odometry = new Odometry(mF[0][0],mF[1][0],0,0,0,0,0);
    // Upravljanje
    var speed = encoder(odometry, mF[2][0], trajectoryGoalPoint, zoom);
    return [speed[0], speed[1], mF[0][0], mF[1][0], mF[2][0]];
  } else {
    brojLBEKF += 1; //Informacija o broju mV != [] iteracija
    var mR = [];
    var step = 0;
    for (var i = 0; i < mRArray.length; i++) {
      var mRrow1 = [];
      var mRrow2 = [];
      for (var j = 0; j < mRArray.length*2; j++) {
        mRrow1.push(0);
        mRrow2.push(0);
      }
      mRrow1[step] = mRArray[i][0][0];
      mRrow1[step+1] = mRArray[i][0][1];
      mRrow2[step] = mRArray[i][1][0];
      mRrow2[step+1] = mRArray[i][1][1];
      mR.push(mRrow1);
      mR.push(mRrow2);
      step += 2;
    }
    // Popravka predikcije
    var sigmaIN = math.add(math.multiply(mH, math.multiply(mP, math.transpose(mH))), mR);
    var mK = math.multiply(mP, math.multiply(math.transpose(mH), math.inv(sigmaIN)));
    mP = math.multiply(math.subtract([[1, 0, 0], [0, 1, 0], [0, 0, 1]], math.multiply(mK, mH)), mP);
    mF = math.add(mF, math.multiply(mK, mV));
    mFArray.push(mF);
    mPArray.push(mP);
    var odometry = new Odometry(mF[0][0],mF[1][0],0,0,0,0,0);
    // Upravljanje
    var speed = encoder(odometry, mF[2][0], trajectoryGoalPoint, zoom);
    return [speed[0], speed[1], mF[0][0], mF[1][0], mF[2][0]];
  }
}

var brojSLAMEKF = 0; //Informacija o broju mV != [] iteracija
var ekfSLAMinit = 1;
var mapLaserScanMemory = [];
function ekfSLAM (robotOdometry, robotAngle, robotJointStates, mapLaserScan, trajectoryGoalPoint, zoom) {
  var b = 0.16;
  var k = 0.9;
  var g = 1;
  if (ekfSLAMinit == 1) {
    dSr.push(robotJointStates.wheelRightJoint*0.033);
    dSl.push(robotJointStates.wheelLeftJoint*0.033);
    mFArray.push([[robotOdometry.posePointPositionX], [robotOdometry.posePointPositionY], [robotAngle]]);
    for (var i = 0; i < mapLaserScan.length; i++) {
      mFArray[0].push([mapLaserScan[i][1]]);
      mFArray[0].push([mapLaserScan[i][0]]);
      mapLaserScanMemory.push(mapLaserScan[i]);
    }
    mPArray[0] = math.multiply(0.01, identityMatrixNxN(3+2*mapLaserScan.length));
    ekfSLAMinit = 0;
  }
  // Predikcija
  dSr.push(robotJointStates.wheelRightJoint*0.033);
  dSl.push(robotJointStates.wheelLeftJoint*0.033);
  var dS = ((dSr[dSr.length-1]-dSr[dSr.length-2])+(dSl[dSl.length-1]-dSl[dSl.length-2]))/2;
  var dTheta = ((dSr[dSr.length-1]-dSr[dSr.length-2])-(dSl[dSl.length-1]-dSl[dSl.length-2]))/b;
  var mQ = math.multiply(k, [[math.abs(dSl[dSl.length-1]-dSl[dSl.length-2]), 0], [0, math.abs(dSr[dSr.length-1]-dSr[dSr.length-2])]]);

 var mapDimension = mapLaserScan.length;
  if (mapDimension > (mFArray[mFArray.length-1].length-3)/2  || mapDimension < (mFArray[mFArray.length-1].length-3)/2) {
    mapDimension = (mFArray[mFArray.length-1].length-3)/2;
  }

  var mFhm = [[dS*math.cos(robotAngle+dTheta/2)], [dS*math.sin(robotAngle+dTheta/2)], [dTheta]];
  for (var i = 0; i < 2*mapDimension; i++) {
    mFhm.push([0]);
  }
  var mF = math.add(mFArray[mFArray.length-1], mFhm);

  var mFx = identityMatrixNxN(3+2*mapDimension);
  mFx[0][2] = -dS*math.sin(robotAngle-dTheta/2);
  mFx[1][2] =  dS*math.cos(robotAngle-dTheta/2);

  var mFu = [[math.cos(robotAngle-dTheta/2)/2+dS*math.sin(robotAngle-dTheta/2)/(2*b), math.cos(robotAngle-dTheta/2)/2-dS*math.sin(robotAngle-dTheta/2)/(2*b)],
         [math.sin(robotAngle-dTheta/2)/2-dS*math.cos(robotAngle-dTheta/2)/(2*b), math.sin(robotAngle-dTheta/2)/2+dS*math.cos(robotAngle-dTheta/2)/(2*b)],
         [-1/b, 1/b]];
  for (var i = 0; i < 2*mapDimension; i++) {
    mFu.push([0, 0]);
  }

  var mP = math.add(math.multiply(mFx, math.multiply(mPArray[mPArray.length-1], math.transpose(mFx))), math.multiply(mFu, math.multiply(mQ, math.transpose(mFu))));
  // Opservacija i pridruzivanje merenja
  var mV = [];
  var mH = [];
  var mRArray = [];
  for (var i = 0; i < mapLaserScan.length; i++) {
    var zj = [[mapLaserScan[i][1]], [mapLaserScan[i][0]]];
    var deltaHArray = [];
    var vijArray = [];
    var pmRArray = [];
    var mahalanobisArray =[];
    for (var j = 0; j < mF.length-3; j+=2) {
      var zi = [[mF[j+3][0]-mF[2][0]], [mF[j+4][0]-(mF[0][0]*math.cos(mF[j+3][0])+mF[1][0]*math.sin(mF[j+3][0]))]];
      var deltaH = zeroMatrixNxM(2, mF.length);
      deltaH[0][2] = -1;
      deltaH[1][0] = -math.cos(mF[j+3][0]);
      deltaH[1][1] = -math.sin(mF[j+3][0]);
      // Prva dva deltaH se ne koriguju.
      if (j+3 >= 7) {
        deltaH[0][j+3] = 1;
        deltaH[1][j+3] = mF[0][0]*math.sin(mF[j+3][0])-mF[1][0]*math.cos(mF[j+3][0]);
        deltaH[1][j+4] = 1;
      }
      if (zi[1][0] < 0) {
        zi[0][0] = zi[0][0]+math.PI;
        zi[1][0] = -zi[1][0];
        deltaH[1] = math.multiply(-1, deltaH[1]);
      }
      if (zi[0][0] > math.PI) {
        zi[0][0] = zi[0][0]-2*math.PI;
      } else if (zi[0][0] < -math.PI) {
        zi[0][0] = zi[0][0]+2*math.PI;
      }
      var vij = math.subtract(zj, zi);
      var sigmaINij = math.add(math.multiply(deltaH, math.multiply(mP, math.transpose(deltaH))), mapLaserScan[i][8]);
      var mahalanobis = math.multiply(math.transpose(vij), math.multiply(math.inv(sigmaINij), vij));
      deltaHArray.push(deltaH);
      vijArray.push(vij);
      pmRArray.push(mapLaserScan[i][8]);
      mahalanobisArray.push(mahalanobis[0][0]);
    }
    var aIndex = mahalanobisArray.indexOf(math.min(mahalanobisArray));
    if (math.abs(mahalanobisArray[aIndex]) <= 0.005) {
      mH.push(deltaHArray[aIndex][0]);
      mH.push(deltaHArray[aIndex][1]);
      mV.push(vijArray[aIndex][0]);
      mV.push(vijArray[aIndex][1]);
      mRArray.push(pmRArray[aIndex]);
    }
  }
  if (mV.length == 0) {
    mFArray.push(mF);
    mPArray.push(mP);
    var odometry = new Odometry(mF[0][0],mF[1][0],0,0,0,0,0);
    // Upravljanje
    var speed = encoder(odometry, mF[2][0], trajectoryGoalPoint, zoom);
    var fC = 0;
    for (var i = 0; i < mapLaserScanMemory.length; i++) {
      mapLaserScanMemory[i][0] = mF[fC+4][0];
      mapLaserScanMemory[i][1] = mF[fC+3][0];
      fC += 2;
    }
    return [speed[0], speed[1], mF[0][0], mF[1][0], mF[2][0], mapLaserScanMemory];
  } else {
    brojSLAMEKF += 1; //Informacija o broju mV != [] iteracija
    var mR = [];
    var step = 0;
    for (var i = 0; i < mRArray.length; i++) {
      var mRrow1 = [];
      var mRrow2 = [];
      for (var j = 0; j < mRArray.length*2; j++) {
        mRrow1.push(0);
        mRrow2.push(0);
      }
      mRrow1[step] = mRArray[i][0][0];
      mRrow1[step+1] = mRArray[i][0][1];
      mRrow2[step] = mRArray[i][1][0];
      mRrow2[step+1] = mRArray[i][1][1];
      mR.push(mRrow1);
      mR.push(mRrow2);
      step += 2;
    }
    // Popravka predikcije
    var sigmaIN = math.add(math.multiply(mH, math.multiply(mP, math.transpose(mH))), mR);
    var mK = math.multiply(mP, math.multiply(math.transpose(mH), math.inv(sigmaIN)));
    mP = math.multiply(math.subtract(identityMatrixNxN(3+2*mapDimension), math.multiply(mK, mH)), mP);
    mF = math.add(mF, math.multiply(mK, mV));
    mFArray.push(mF);
    mPArray.push(mP);
    var odometry = new Odometry(mF[0][0],mF[1][0],0,0,0,0,0);
    // Upravljanje
    var speed = encoder(odometry, mF[2][0], trajectoryGoalPoint, zoom);
    var fC = 0;
    for (var i = 0; i < mapLaserScanMemory.length; i++) {
      mapLaserScanMemory[i][0] = mF[fC+4][0];
      mapLaserScanMemory[i][1] = mF[fC+3][0];
      fC += 2;
    }
    return [speed[0], speed[1], mF[0][0], mF[1][0], mF[2][0], mapLaserScanMemory];
  }
}

var pathNodeDrawList = [];
var pathNodeDrawOL = [];
var pathNodeDrawCL =[];
var pathNodeDrawTP =[];
function GridNode (gnId, gnWd, gnH, gnNXP, gnNYP, gnPixelArray, gnOpen, gnClosed, gnF, gnG) {
  this.gnId = gnId;
  this.gnWd = gnWd;
  this.gnH = gnH;
  this.gnNXP = gnNXP;
  this.gnNYP = gnNYP;
  this.gnPixelArray = gnPixelArray;
  this.gnOpen = gnOpen;
  this.gnClosed = gnClosed;
  this.gnF = gnF;
  this.gnG = gnG;
  this.updateGridNode = function (gnId, gnWd, gnH, gnNXP, gnNYP, gnPixelArray, gnOpen, gnClosed, gnF, gnG) {
    this.gnId = gnId;
    this.gnWd = gnWd;
    this.gnH = gnH;
    this.gnNXP = gnNXP;
    this.gnNYP = gnNYP;
    this.gnPixelArray = gnPixelArray;
    this.gnOpen = gnOpen;
    this.gnClosed = gnClosed;
    this.gnF = gnF;
    this.gnG = gnG;
  }
}

function drawGridNodeGrid () {
  for (var i = 0; i <=500; i += 4) {
    context.beginPath();
    context.moveTo(0,i);
    context.lineTo(500,i);
    context.strokeStyle = "#B0C9D9";
    context.stroke();
    context.beginPath();
    context.moveTo(i,0);
    context.lineTo(i,500);
    context.strokeStyle = "#B0C9D9";
    context.stroke();
  }
}
function drawGridNodeWallMap (eGridMap, zoom) {
  if (eGridMap.gnWd == 10) {
    context.fillStyle = "#000000";
    context.fillRect(convertCoordinateX(mToCm(eGridMap.gnNXP-0.02), zoom), convertCoordinateY(mToCm(eGridMap.gnNYP+0.02), zoom), 2, 2);
  }
}
function drawGridNodePath (ePathNodeDrawList, gridMapData, zoom) {
  var eGridMap = gridMapData[ePathNodeDrawList.iX][ePathNodeDrawList.iY];
  context.fillStyle = "#BF212F";
  context.fillRect(convertCoordinateX(mToCm(eGridMap.gnNXP-0.02), zoom), convertCoordinateY(mToCm(eGridMap.gnNYP+0.02), zoom), 2, 2);
}
function drawGridNodeOpenList (ePathNodeDrawList, gridMapData, zoom) {
  var eGridMap = gridMapData[ePathNodeDrawList.iX][ePathNodeDrawList.iY];
  context.fillStyle = "#27B376";
  context.fillRect(convertCoordinateX(mToCm(eGridMap.gnNXP-0.02), zoom), convertCoordinateY(mToCm(eGridMap.gnNYP+0.02), zoom), 2, 2);
}
function drawGridNodeClosedList (ePathNodeDrawList, gridMapData, zoom) {
  var eGridMap = gridMapData[ePathNodeDrawList.iX][ePathNodeDrawList.iY];
  context.fillStyle = "#F9A73E";
  context.fillRect(convertCoordinateX(mToCm(eGridMap.gnNXP-0.02), zoom), convertCoordinateY(mToCm(eGridMap.gnNYP+0.02), zoom), 2, 2);
}
function drawGridNodeTargetPoints (ePathNodeDrawList, gridMapData, zoom) {
  var eGridMap = gridMapData[ePathNodeDrawList.iX][ePathNodeDrawList.iY];
  context.fillStyle = "#800080";
  context.fillRect(convertCoordinateX(mToCm(eGridMap.gnNXP-0.02), zoom), convertCoordinateY(mToCm(eGridMap.gnNYP+0.02), zoom), 2, 2);
}

function fillGridCanvas (wallsMatrix, ctx, zoom) {
  for (var i = 0; i < wallsMatrix.length; i++) {
    if (wallsMatrix[i][0] != wallsMatrix[i][2] && wallsMatrix[i][1] != wallsMatrix[i][3]) {
      var cX = 0;
      var cY = 0;
      var xP = 0;
      var yP = 0;
      var wAngle = 0;
      var wL = 0;
      var wW = 0;
      if (wallsMatrix[i][0] < wallsMatrix[i][2] && wallsMatrix[i][1] > wallsMatrix[i][3]) {
        cX = wallsMatrix[i][0]+math.abs(wallsMatrix[i][2]-wallsMatrix[i][0])/2;
        cY = wallsMatrix[i][1]-math.abs(wallsMatrix[i][3]-wallsMatrix[i][1])/2;
      } else if (wallsMatrix[i][0] < wallsMatrix[i][2] && wallsMatrix[i][1] < wallsMatrix[i][3]) {
        cX = wallsMatrix[i][0]+math.abs(wallsMatrix[i][2]-wallsMatrix[i][0])/2;
        cY = wallsMatrix[i][1]+math.abs(wallsMatrix[i][3]-wallsMatrix[i][1])/2;
      } else if (wallsMatrix[i][0] > wallsMatrix[i][2] && wallsMatrix[i][1] > wallsMatrix[i][3]) {
        cX = wallsMatrix[i][0]-math.abs(wallsMatrix[i][2]-wallsMatrix[i][0])/2;
        cY = wallsMatrix[i][1]-math.abs(wallsMatrix[i][3]-wallsMatrix[i][1])/2;
      } else if (wallsMatrix[i][0] > wallsMatrix[i][2] && wallsMatrix[i][1] < wallsMatrix[i][3]) {
        cX = wallsMatrix[i][0]-math.abs(wallsMatrix[i][2]-wallsMatrix[i][0])/2;
        cY = wallsMatrix[i][1]+math.abs(wallsMatrix[i][3]-wallsMatrix[i][1])/2;
      }
      xP = convertCoordinateX(cX-wallsMatrix[i][5]/2-math.sqrt(math.pow((cX-wallsMatrix[i][0]),2)+math.pow((cY-wallsMatrix[i][1]), 2)), zoom);
      yP = convertCoordinateY(cY+wallsMatrix[i][5]/2, zoom);
      wAngle = -math.atan2((wallsMatrix[i][3]-wallsMatrix[i][1]), (wallsMatrix[i][2]-wallsMatrix[i][0]));
      wL = lengthD(math.sqrt(math.pow((cX-wallsMatrix[i][0]),2)+math.pow((cY-wallsMatrix[i][1]), 2))*2+wallsMatrix[i][5], zoom);;
      wW = lengthD(wallsMatrix[i][5], zoom);
      ctx.save();
      ctx.translate(xP+wL/2, yP+wW/2);
      ctx.rotate(wAngle);
      ctx.fillStyle = "#996633";
      ctx.fillRect(-wL/2, -wW/2, wL, wW);
      ctx.restore();
    } else if (wallsMatrix[i][0] == wallsMatrix[i][2] || wallsMatrix[i][1] == wallsMatrix[i][3]) {
      var xP = 0;
      var yP = 0;
      var wL = 0;
      var wW = 0;
      if (wallsMatrix[i][1] == wallsMatrix[i][3]) {
        yP = convertCoordinateY(wallsMatrix[i][1]+wallsMatrix[i][5]/2, zoom);
        if (wallsMatrix[i][0] < wallsMatrix[i][2]) {
          xP = convertCoordinateX(wallsMatrix[i][0]-wallsMatrix[i][5]/2, zoom);
        } else {
          xP = convertCoordinateX(wallsMatrix[i][2]-wallsMatrix[i][5]/2, zoom);
        }
        wL = lengthD(math.abs(wallsMatrix[i][2]-wallsMatrix[i][0])+wallsMatrix[i][5], zoom);
        wW = lengthD(wallsMatrix[i][5], zoom);
      } else {
        xP = convertCoordinateX(wallsMatrix[i][0]-wallsMatrix[i][5]/2, zoom);
        if (wallsMatrix[i][1] > wallsMatrix[i][3]) {
          yP = convertCoordinateY(wallsMatrix[i][1]+wallsMatrix[i][5]/2, zoom);
        } else {
          yP = convertCoordinateY(wallsMatrix[i][3]+wallsMatrix[i][5]/2, zoom);
        }
        wL = lengthD(wallsMatrix[i][5], zoom);
        wW = lengthD(math.abs(wallsMatrix[i][3]-wallsMatrix[i][1])+wallsMatrix[i][5], zoom);
      }
      ctx.fillStyle = "#996633";
      ctx.fillRect(xP, yP, wL, wW);
    }
  }
}

function gridMapGenerator (robotOdometry, trajectoryGoalPoint, wallsMatrix, zoom) {
  var gridMap = [];
  var gridCanvas = document.createElement('canvas');
  gridCanvas.width = 500;
  gridCanvas.height = 500;
  var ctx = gridCanvas.getContext("2d");
  var wallsM = wallsMatrix;
  for (var i = 0; i < wallsM.length; i++) {
    wallsM[i][5] = wallsM[i][5]*1.5*zoom; //faktor debljine zida za mapu
  }
  fillGridCanvas(wallsM, ctx, zoom);
  for (var i = 0; i < 125; i++) {
    gridMap.push([]);
    for (var j = 0; j < 125; j++) {
      gridMap[i].push(0);
    }
  }
  var startNode = [0, 0];
  var endNode = [0, 0];
  var imageData = ctx.getImageData(0, 0, 500, 500);
  for (var i = 0; i < 125; i++) {
    for (var j = 0; j < 125; j++) {
      var valueId = 0;
      var valueWd = 0;
      var valueH = 0;
      var valueNXP = 0;
      var valueNYP = 0;
      var elementPixelArray = [];
      var valueOpen = 0;
      var valueClosed = 0;
      var valueF = 0;
      var valueG = 0;
      for (var k = j*4; k < (j+1)*4; k++) {
        for (var l = i*4; l < (i+1)*4; l++) {
          var pixelIndex = 4 * (k + l * 500);
          if (imageData.data[pixelIndex] == 153 && imageData.data[pixelIndex+1] == 102 && imageData.data[pixelIndex+2] == 51) {
            valueId = 1;
            valueWd = 10;
          }
          if (convertCoordinateX(mToCm(math.round(robotOdometry.posePointPositionX)), zoom) == k && convertCoordinateY(mToCm(math.round(robotOdometry.posePointPositionY)), zoom) == l) {
            startNode = [i, j];
          }
          if (trajectoryGoalPoint.tpX == k && trajectoryGoalPoint.tpY == l) {
            endNode = [i, j];
          }
          elementPixelArray.push(pixelIndex);
        }
      }
      valueNXP = cmToM(displayCoordinateX((j+1)*4-2, zoom));
      valueNYP = cmToM(displayCoordinateY((i+1)*4-2, zoom));
      valueH = math.sqrt(math.pow(cmToM(displayCoordinateX(trajectoryGoalPoint.tpX, zoom))-valueNXP, 2)+
                         math.pow(cmToM(displayCoordinateY(trajectoryGoalPoint.tpY, zoom))-valueNYP, 2));
      gridMap[i][j] = new GridNode(valueId, valueWd, valueH, valueNXP, valueNYP, elementPixelArray, valueOpen, valueClosed, valueF, valueG);
    }
  }
  gridMap[endNode[0]][endNode[1]].gnH = 0;
  return [startNode, endNode, gridMap];
}

function pathNodeListFilter (pNodeList, gridMapData) {
  console.log(pNodeList);
  var hpNL = pNodeList;
  var hpNLFirst = pNodeList[0];
  var hpNLLast = pNodeList[pNodeList.length-1];
  var lineList = [];
  var eLL = [];
  var rE = hpNL[0];
  eLL.push(hpNL[0]);
  hpNL.shift();
  var lNode1X = gridMapData[2][rE.iX][rE.iY].gnNXP;
  var lNode1Y = gridMapData[2][rE.iX][rE.iY].gnNYP;
  var lNode2X = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNXP;
  var lNode2Y = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNYP;
  var dX1 = lNode2X-lNode1X;
  var dY1 = lNode2Y-lNode1Y;
  var rAlpha = math.round(math.atan2(dY1, dX1), 2);
  eLL.push(hpNL[0]);
  hpNL.shift();
  var id = 1;
  while (hpNL.length != 0) {
    lNode1X = gridMapData[2][rE.iX][rE.iY].gnNXP;
    lNode1Y = gridMapData[2][rE.iX][rE.iY].gnNYP;
    lNode2X = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNXP;
    lNode2Y = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNYP;
    dX1 = lNode2X-lNode1X;
    dY1 = lNode2Y-lNode1Y;
    var vAlpha = math.round(math.atan2(dY1, dX1), 2);
    if (vAlpha == rAlpha) {
      eLL.push(hpNL[0]);
      hpNL.shift();
    } else {
      rE = eLL[eLL.length-1];
      if (eLL.length > 3) {
        lineList.push([eLL, rAlpha, id]);
        id+=1;
      }
      eLL = [];
      eLL.push(rE);
      lNode1X = gridMapData[2][rE.iX][rE.iY].gnNXP;
      lNode1Y = gridMapData[2][rE.iX][rE.iY].gnNYP;
      lNode2X = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNXP;
      lNode2Y = gridMapData[2][hpNL[0].iX][hpNL[0].iY].gnNYP;
      dX1 = lNode2X-lNode1X;
      dY1 = lNode2Y-lNode1Y;
      rAlpha = math.round(math.atan2(dY1, dX1), 2);
      eLL.push(hpNL[0]);
      hpNL.shift();
    }
  }
  var currentElement = lineList[0];
  var mergeList = [];
  for (var i = 0; i < lineList.length; i++) {
    if (lineList[i][1] == currentElement[1] && lineList[i][2] == currentElement[2]) {
    } else if (lineList[i][1] == currentElement[1] && lineList[i][2]-1 == currentElement[2]) {
      currentElement = [currentElement[0].concat(lineList[i][0]), currentElement[1], lineList[i][2]];
    } else {
      mergeList.push(currentElement);
      currentElement = lineList[i];
      if (currentElement == lineList[lineList.length-1]) {
        mergeList.push(currentElement);
      }
    }
  }
  console.log(mergeList);
  hpNL = [];
  for (var i = 0; i < mergeList.length; i++) {
    hpNL.push(mergeList[i][0][mergeList[i][0].length-1]);
  }
  if (mergeList[mergeList.length-1][0][mergeList[mergeList.length-1][0].length-1] != hpNLLast) {
    hpNL.push(hpNLLast);
  }
  if (mergeList[0][0][0] != hpNLFirst || mergeList[0][0][0] == hpNLFirst) {
    hpNL.unshift(hpNLFirst);
  }
  console.log(hpNL);
  for (var i = 0; i < hpNL.length; i++) {
    pathNodeDrawTP.push({iX: hpNL[i].iX, iY: hpNL[i].iY});
  }
  pNodeList = hpNL;
  return pNodeList;
}

var pathNodeList = [];
var nodeOpenList = [];
var nodeClosedList = [];
var controllerStopMode = 0;
var switchCSM = 0;
var previousNode = {iX: 0, iY: 0, cost: 0, heuristic: 0, fOfNode: 0, parent: {iX: 0, iY: 0}}
var pathNodeCounter = 0;
function aStarPSAController (robotOdometry, robotAngle, gridMapData, trajectoryGoalPoint, zoom) { // PSA - path search algorithm
  var velocity = 0;
  var omega = 0;
  var rPX = robotOdometry.posePointPositionX;
  var rPY = robotOdometry.posePointPositionY;
  var gPX = cmToM(displayCoordinateX(trajectoryGoalPoint.tpX, zoom));
  var gPY = cmToM(displayCoordinateY(trajectoryGoalPoint.tpY, zoom));
  if (controllerStopMode == 0) {
    if (pathNodeList.length == 0) { //robot na pocetku
      if (gridMapData[0][0]-1 > -1) {
        if (gridMapData[0][1]-1 > -1) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnG = g;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1]-1});
          nodeOpenList.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1]-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]-1].gnOpen = 1;
        }
        if (gridMapData[0][1] > -1 && gridMapData[0][1] < 125) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnWd;
          var h = gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnG = g;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1]});
          nodeOpenList.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1], cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]].gnOpen = 1;
        }
        if (gridMapData[0][1]+1 < 125) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnG = g;
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1]+1});
          nodeOpenList.push({iX: gridMapData[0][0]-1, iY: gridMapData[0][1]+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]-1][gridMapData[0][1]+1].gnOpen = 1;
        }
      }
      if (gridMapData[0][0] > -1 && gridMapData[0][0] < 125) {
        if (gridMapData[0][1]-1 > -1) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnG = g;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0], iY: gridMapData[0][1]-1});
          nodeOpenList.push({iX: gridMapData[0][0], iY: gridMapData[0][1]-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]-1].gnOpen = 1;
        }
        if (gridMapData[0][1] > -1 && gridMapData[0][1] < 125) {
          var g = 0;
          var h = gridMapData[2][gridMapData[0][0]][gridMapData[0][1]].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]].gnG = g;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]].gnF = f;
          pathNodeDrawCL.push({iX: gridMapData[0][0], iY: gridMapData[0][1]});
          nodeClosedList.push({iX: gridMapData[0][0], iY: gridMapData[0][1], cost: g, heuristic: h, fOfNode: f, parent: {iX: -1, iY: -1}});
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]].gnClosed = 1;
          pathNodeDrawList.push({iX: gridMapData[0][0], iY: gridMapData[0][1]});
          pathNodeList.push({iX: gridMapData[0][0], iY: gridMapData[0][1], cost: g, heuristic: h, fOfNode: f, parent: {iX: -1, iY: -1}});
        }
        if (gridMapData[0][1]+1 < 125) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnG = g;
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0], iY: gridMapData[0][1]+1});
          nodeOpenList.push({iX: gridMapData[0][0], iY: gridMapData[0][1]+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]][gridMapData[0][1]+1].gnOpen = 1;
        }
      }
      if (gridMapData[0][0]+1 < 125) {
        if (gridMapData[0][1]-1 > -1) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnG = g;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1]-1});
          nodeOpenList.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1]-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]-1].gnOpen = 1;
        }
        if (gridMapData[0][1] > -1 && gridMapData[0][1] < 125) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnWd;
          var h = gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnG = g;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1]});
          nodeOpenList.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1], cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]].gnOpen = 1;
        }
        if (gridMapData[0][1]+1 < 125) {
          var g = math.sqrt(math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnNXP-rPX, 2)+
                            math.pow(gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnNYP-rPY, 2))+
                            gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnWd;
          var h = gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnH;
          var f = g+h;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnG = g;
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnF = f;
          pathNodeDrawOL.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1]+1});
          nodeOpenList.push({iX: gridMapData[0][0]+1, iY: gridMapData[0][1]+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: gridMapData[0][0], iY: gridMapData[0][1]}});
          gridMapData[2][gridMapData[0][0]+1][gridMapData[0][1]+1].gnOpen = 1;
        }
      }
      nodeOpenList.sort(function(a, b){return a.fOfNode - b.fOfNode});
      var helperNOL = [];
      helperNOL.push({e: nodeOpenList[0], index: 0});
      for (var i = 0; i < nodeOpenList.length; i++) {
        if ((nodeOpenList[0].fOfNode == nodeOpenList[i].fOfNode) && (nodeOpenList[0].cost != nodeOpenList[i].cost)) {
          helperNOL.push({e: nodeOpenList[i], index: i});
        }
      }
      if (helperNOL.length > 1) {
        helperNOL.sort(function(a, b){return a.e.cost - b.e.cost});
        if (nodeOpenList[0].cost != helperNOL[0].e.cost) {
          nodeOpenList.splice(helperNOL[0].i, 1);
          nodeOpenList.unshift(helperNOL[0].e);
        }
      }
      if (gridMapData[1][0] == nodeOpenList[0].iX && gridMapData[1][1] == nodeOpenList[0].iY) {
        controllerStopMode = 1;
        pathNodeDrawCL.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        nodeClosedList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnClosed = 1;
        pathNodeDrawList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        pathNodeList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnOpen = 0;
        nodeOpenList.shift();
      } else if (gridMapData[1][0] == nodeClosedList[0].iX && gridMapData[1][1] == nodeClosedList[0].iY) {
        controllerStopMode = 1;
        pathNodeDrawList.push({iX: nodeClosedList[0].iX, iY: nodeClosedList[0].iY});
        pathNodeList.push({iX: nodeClosedList[0].iX, iY: nodeClosedList[0].iY, cost: nodeClosedList[0].cost, heuristic: nodeClosedList[0].heuristic, fOfNode: nodeClosedList[0].fOfNode, parent: nodeClosedList[0].parent});
      } else {
        pathNodeDrawCL.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        nodeClosedList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnClosed = 1;
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnOpen = 0;
        nodeOpenList.shift();
        previousNode = nodeClosedList[nodeClosedList.length-1];
      }
    } else if (pathNodeList.length != 0) {
      var nPX = gridMapData[2][previousNode.iX][previousNode.iY].gnNXP;
      var nPY = gridMapData[2][previousNode.iX][previousNode.iY].gnNYP;
      if (previousNode.iX-1 > -1) {
        if (previousNode.iY-1 > -1) {
          if (gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnG = g;
            gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX-1, iY: previousNode.iY-1});
            nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnF) || (f == gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnF && g < gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX-1 && nodeOpenList[i].iY == previousNode.iY-1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnOpen = 1;
              gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnG = g;
              gridMapData[2][previousNode.iX-1][previousNode.iY-1].gnF = f;
            }
          }
        }
        if (previousNode.iY > -1 && previousNode.iY < 125) {
          if (gridMapData[2][previousNode.iX-1][previousNode.iY].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX-1][previousNode.iY].gnG = g;
            gridMapData[2][previousNode.iX-1][previousNode.iY].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX-1, iY: previousNode.iY});
            nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX-1][previousNode.iY].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX-1][previousNode.iY].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX-1][previousNode.iY].gnF) || (f == gridMapData[2][previousNode.iX-1][previousNode.iY].gnF && g < gridMapData[2][previousNode.iX-1][previousNode.iY].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX-1 && nodeOpenList[i].iY == previousNode.iY) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX-1][previousNode.iY].gnOpen = 1;
              gridMapData[2][previousNode.iX-1][previousNode.iY].gnG = g;
              gridMapData[2][previousNode.iX-1][previousNode.iY].gnF = f;
            }
          }
        }
        if (previousNode.iY+1 < 125) {
          if (gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnG = g;
            gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX-1, iY: previousNode.iY+1});
            nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnF) || (f == gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnF && g < gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX-1 && nodeOpenList[i].iY == previousNode.iY+1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX-1, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnOpen = 1;
              gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnG = g;
              gridMapData[2][previousNode.iX-1][previousNode.iY+1].gnF = f;
            }
          }
        }
      }
      if (previousNode.iX > -1 && previousNode.iX < 125) {
        if (previousNode.iY-1 > -1) {
          if (gridMapData[2][previousNode.iX][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX][previousNode.iY-1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX][previousNode.iY-1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX][previousNode.iY-1].gnG = g;
            gridMapData[2][previousNode.iX][previousNode.iY-1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX, iY: previousNode.iY-1});
            nodeOpenList.push({iX: previousNode.iX, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX][previousNode.iY-1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX][previousNode.iY-1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX][previousNode.iY-1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX][previousNode.iY-1].gnF) || (f == gridMapData[2][previousNode.iX][previousNode.iY-1].gnF && g < gridMapData[2][previousNode.iX][previousNode.iY-1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX && nodeOpenList[i].iY == previousNode.iY-1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX][previousNode.iY-1].gnOpen = 1;
              gridMapData[2][previousNode.iX][previousNode.iY-1].gnG = g;
              gridMapData[2][previousNode.iX][previousNode.iY-1].gnF = f;
            }
          }
        }
        if (previousNode.iY+1 < 125) {
          if (gridMapData[2][previousNode.iX][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX][previousNode.iY+1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX][previousNode.iY+1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX][previousNode.iY+1].gnG = g;
            gridMapData[2][previousNode.iX][previousNode.iY+1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX, iY: previousNode.iY+1});
            nodeOpenList.push({iX: previousNode.iX, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX][previousNode.iY+1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX][previousNode.iY+1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX][previousNode.iY+1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX][previousNode.iY+1].gnF) || (f == gridMapData[2][previousNode.iX][previousNode.iY+1].gnF && g < gridMapData[2][previousNode.iX][previousNode.iY+1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX && nodeOpenList[i].iY == previousNode.iY+1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX][previousNode.iY+1].gnOpen = 1;
              gridMapData[2][previousNode.iX][previousNode.iY+1].gnG = g;
              gridMapData[2][previousNode.iX][previousNode.iY+1].gnF = f;
            }
          }
        }
      }
      if (previousNode.iX+1 < 125) {
        if (previousNode.iY-1 > -1) {
          if (gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnG = g;
            gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX+1, iY: previousNode.iY-1});
            nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnF) || (f == gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnF && g < gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX+1 && nodeOpenList[i].iY == previousNode.iY-1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY-1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnOpen = 1;
              gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnG = g;
              gridMapData[2][previousNode.iX+1][previousNode.iY-1].gnF = f;
            }
          }
        }
        if (previousNode.iY > -1 && previousNode.iY < 125) {
          if (gridMapData[2][previousNode.iX+1][previousNode.iY].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX+1][previousNode.iY].gnG = g;
            gridMapData[2][previousNode.iX+1][previousNode.iY].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX+1, iY: previousNode.iY});
            nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX+1][previousNode.iY].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX+1][previousNode.iY].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX+1][previousNode.iY].gnF) || (f == gridMapData[2][previousNode.iX+1][previousNode.iY].gnF && g < gridMapData[2][previousNode.iX+1][previousNode.iY].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX+1 && nodeOpenList[i].iY == previousNode.iY) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX+1][previousNode.iY].gnOpen = 1;
              gridMapData[2][previousNode.iX+1][previousNode.iY].gnG = g;
              gridMapData[2][previousNode.iX+1][previousNode.iY].gnF = f;
            }
          }
        }
        if (previousNode.iY+1 < 125) {
          if (gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnOpen == 0) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnH;
            var f = g+h;
            gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnG = g;
            gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnF = f;
            pathNodeDrawOL.push({iX: previousNode.iX+1, iY: previousNode.iY+1});
            nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
            gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnOpen = 1;
          }
          if (gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnClosed == 0 && gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnOpen == 1) {
            var g = math.sqrt(math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnNXP-nPX, 2)+
                              math.pow(gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnNYP-nPY, 2))+
                              gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnWd + previousNode.cost;
            var h = gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnH;
            var f = g+h;
            if ((f < gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnF) || (f == gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnF && g < gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnG)) {
              for (var i = 0; i < nodeOpenList.length; i++) {
                if (nodeOpenList[i].iX == previousNode.iX+1 && nodeOpenList[i].iY == previousNode.iY+1) {
                  nodeOpenList.splice(i, 1);
                }
              }
              nodeOpenList.push({iX: previousNode.iX+1, iY: previousNode.iY+1, cost: g, heuristic: h, fOfNode: f, parent: {iX: previousNode.iX, iY: previousNode.iY}});
              gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnOpen = 1;
              gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnG = g;
              gridMapData[2][previousNode.iX+1][previousNode.iY+1].gnF = f;
            }
          }
        }
      }
      nodeOpenList.sort(function(a, b){return a.fOfNode - b.fOfNode});
      var helperNOL = [];
      helperNOL.push({e: nodeOpenList[0], index: 0});
      for (var i = 0; i < nodeOpenList.length; i++) {
        if ((nodeOpenList[0].fOfNode == nodeOpenList[i].fOfNode) && (nodeOpenList[0].cost != nodeOpenList[i].cost)) {
          helperNOL.push({e: nodeOpenList[i], index: i});
        }
      }
      if (helperNOL.length > 1) {
        helperNOL.sort(function(a, b){return a.e.cost - b.e.cost});
        if (nodeOpenList[0].cost != helperNOL[0].e.cost) {
          nodeOpenList.splice(helperNOL[0].i, 1);
          nodeOpenList.unshift(helperNOL[0].e);
        }
      }
      if (gridMapData[1][0] == nodeOpenList[0].iX && gridMapData[1][1] == nodeOpenList[0].iY) {
        controllerStopMode = 1;
        pathNodeDrawCL.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        nodeClosedList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnClosed = 1;
        pathNodeDrawList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        pathNodeList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnOpen = 0;
        nodeOpenList.shift();
        var pStart = pathNodeList[0].parent;
        var pEnd = pathNodeList[1].parent;
        pathNodeDrawList.shift();
        pathNodeList.shift();
        while (!(pStart.iX == pEnd.iX && pStart.iY == pEnd.iY)) {
          for (var i = 0; i < nodeClosedList.length; i++) {
            if (nodeClosedList[i].iX == pEnd.iX && nodeClosedList[i].iY == pEnd.iY) {
              pEnd = nodeClosedList[i].parent;
              pathNodeDrawList.push({iX: nodeClosedList[i].iX, iY: nodeClosedList[i].iY});
              pathNodeList.push(nodeClosedList[i]);
              break;
            }
          }
        }
        pathNodeList.reverse();
        pathNodeList = pathNodeListFilter(pathNodeList, gridMapData);
      } else {
        previousNode = {iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent}
        pathNodeDrawCL.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY});
        nodeClosedList.push({iX: nodeOpenList[0].iX, iY: nodeOpenList[0].iY, cost: nodeOpenList[0].cost, heuristic: nodeOpenList[0].heuristic, fOfNode: nodeOpenList[0].fOfNode, parent: nodeOpenList[0].parent});
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnClosed = 1;
        gridMapData[2][nodeOpenList[0].iX][nodeOpenList[0].iY].gnOpen = 0;
        nodeOpenList.shift();
      }
    }
  }
  if (controllerStopMode == 1) {
    if (pathNodeCounter+1 < pathNodeList.length-1) {
      var lNode1X = gridMapData[2][pathNodeList[pathNodeCounter].iX][pathNodeList[pathNodeCounter].iY].gnNXP;
      var lNode1Y = gridMapData[2][pathNodeList[pathNodeCounter].iX][pathNodeList[pathNodeCounter].iY].gnNYP;
      var lNode2X = gridMapData[2][pathNodeList[pathNodeCounter+1].iX][pathNodeList[pathNodeCounter+1].iY].gnNXP;
      var lNode2Y = gridMapData[2][pathNodeList[pathNodeCounter+1].iX][pathNodeList[pathNodeCounter+1].iY].gnNYP;
      var condition = math.sqrt(math.pow(lNode2X-rPX, 2)+math.pow(lNode2Y-rPY, 2));
      if (condition < cmToM(distanceToleranceInput.value)) {
       pathNodeCounter += 1;
      } else {
        var dX = lNode2X-rPX;
        var dY = lNode2Y-rPY;
        var dX1 = lNode2X-lNode1X;
        var dY1 = lNode2Y-lNode1Y;
        var angle1 = math.atan2(dY1, dX1);
        var dAlpha = (angle1-robotAngle+math.PI) % (2*math.PI) - math.PI;
        var constantRo=0.066/2;
        if (math.abs(dAlpha) > 0.03) {
          if (dAlpha > 0) {
            omega = 0.01;
          } else {
            omega = -0.01;
          }
          velocity = 0.0;
        } else {
          omega = 0.0;
          velocity = constantRo * math.sqrt(math.pow(dX, 2)+math.pow(dY, 2));
        }
        if (constantSpeed == 1) {
          velocity = velocity*3;
          omega = omega*3;
        }
      }
    } else if (pathNodeCounter+1 == pathNodeList.length-1) {
      controllerStopMode = 2;
    }
  }
  if (controllerStopMode == 2) {
    var dX = gPX-rPX;
    var dY = gPY-rPY;
    var angle = math.atan2(dY, dX);
    var dAlpha = (angle-robotAngle+math.PI) % (2*math.PI) - math.PI;
    var constantRo=0.066/2;
    if (math.abs(dAlpha) > 0.03 && switchCSM == 0) {
      if (dAlpha > 0) {
        omega = 0.01;
      } else {
        omega = -0.01;
      }
      velocity = 0.0;
    } else {
      omega = 0.0;
      velocity = constantRo * math.sqrt(math.pow(dX, 2)+math.pow(dY, 2));
    }
    if (math.sqrt(math.pow(dX, 2)+math.pow(dY, 2)) < cmToM(distanceToleranceInput.value)) {
      switchCSM = 1;
    }
    var dGoalAngle = (THREE.Math.degToRad(trajectoryGoalPoint.tpTheta)-robotAngle+math.PI) % (2*math.PI) - math.PI;
    if (switchCSM == 1) {
      if (math.abs(dGoalAngle) > 0.03) {
        if (dGoalAngle > 0) {
          omega = 0.01;
        } else {
          omega = -0.01;
        }
        velocity = 0.0;
      } else {
        omega = 0.0;
        velocity = 0.0;
      }
    }
    if (constantSpeed == 1) {
      velocity = velocity*3;
      omega = omega*3;
    }
  }
  return [velocity, omega];
}

function drawGridMap () {
  for (var i = 0; i <=500; i += 10) {
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(500, i);
    context.strokeStyle = "#B0C9D9";
    context.stroke();
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, 500);
    context.strokeStyle = "#B0C9D9";
    context.stroke();
  }
  context.beginPath();
  context.moveTo(0, 250);
  context.lineTo(500, 250);
  context.strokeStyle = "#024059";
  context.stroke();
  context.beginPath();
  context.moveTo(250, 0);
  context.lineTo(250, 500);
  context.strokeStyle = "#024059";
  context.stroke();
}

var robotOdometryArray = [];
var robotOAMemory = [];
function drawSampleRate (eRobotOdometryArray, step) {
  robotOdometryArray.push(eRobotOdometryArray);
  if (robotOdometryArray.length == step) {
    robotOAMemory.push(robotOdometryArray[step-1]);
    robotOdometryArray = [];
  }
}
function drawPointGraph (robotOdometryArray, zoom) {
  drawGridMap();
  if (robotOdometryArray.length != 0) {
    for (var i = 0; i < robotOdometryArray.length; i++) {
      if (robotOdometryArray[i].numOfElem == 2) {
        context.fillStyle = "#03658C";
        context.fillRect(convertCoordinateX(mToCm(robotOdometryArray[i].x), zoom),
                         convertCoordinateY(mToCm(robotOdometryArray[i].y), zoom), 2, 2);
      } else if (robotOdometryArray[i].numOfElem == 4) {
        context.fillStyle = "#03658C";
        context.fillRect(convertCoordinateX(mToCm(robotOdometryArray[i].x), zoom),
                         convertCoordinateY(mToCm(robotOdometryArray[i].y), zoom), 2, 2);
        context.fillStyle = "#543864";
        context.fillRect(convertCoordinateX(mToCm(robotOdometryArray[i].xEKF), zoom),
                         convertCoordinateY(mToCm(robotOdometryArray[i].yEKF), zoom), 2, 2);
      }
    }
  }
}

document.getElementById("robotDisplayData").value = "Ispis trenutne pozicije i zadate brzine robota:"+"\n"+
                                                    "x: 0.0000 [m] | xEKF: 0.0000 [m]"+"\n"+
                                                    "y: 0.0000 [m] | yEKF: 0.0000 [m]"+"\n"+
                                                    "theta: 0.0000 [rad] | thetaEKF: 0.0000 [rad]"+"\n"+
                                                    "v: 0.0000 [m/s] | omega: 0.0000 [rad/s]"; // s - step

function displayRobotInfo (robotDataArray) {
  if (robotDataArray.length == 1) {
    document.getElementById("robotDisplayData").value = ("Ispis trenutne pozicije i zadate brzine robota:"+"\n"+
                                                        "x: "+robotDataArray[0].x.toFixed(4)+" [m] | xEKF: "+robotDataArray[0].xEKF.toFixed(4)+" [m]"+"\n"+
                                                        "y: "+robotDataArray[0].y.toFixed(4)+" [m] | yEKF: "+robotDataArray[0].yEKF.toFixed(4)+" [m]"+"\n"+
                                                        "theta: "+robotDataArray[0].theta.toFixed(4)+" [rad] | thetaEKF: "+robotDataArray[0].thetaEKF.toFixed(4)+" [rad]"+"\n"+
                                                        "v: "+robotDataArray[0].v.toFixed(4)+" [m/s] | omega: "+robotDataArray[0].omega.toFixed(4)+" [rad/s]").toString(); // s - step
    robotDataArray.shift();
  }
}

function displayRobotTP () {
  var textArrayElement = "";
  if (objectSelect == changeObject[0]) {
    for (var i = 0; i < objectSelect.length; i++) {
      if (i != objectSelect.length-1) {
        textArrayElement += ("[" + displayCoordinateX(objectSelect[i].tbX, test_zoom).toFixed(2) + ", " + displayCoordinateY(objectSelect[i].tbY, test_zoom).toFixed(2) + ", " + objectSelect[i].tbTheta.toFixed(2) + "], ").toString();
      } else {
        textArrayElement += ("[" + displayCoordinateX(objectSelect[i].tbX, test_zoom).toFixed(2) + ", " + displayCoordinateY(objectSelect[i].tbY, test_zoom).toFixed(2) + ", " + objectSelect[i].tbTheta.toFixed(2) + "]").toString();
      }
    }
  } else {
    for (var i = 0; i < objectSelect.length; i++) {
      if (i != objectSelect.length-1) {
        textArrayElement += ("[" + displayCoordinateX(objectSelect[i].tpX, test_zoom) + ", " + displayCoordinateY(objectSelect[i].tpY, test_zoom) + ", " + objectSelect[i].tpTheta + "], ").toString();
      } else {
        textArrayElement += ("[" + displayCoordinateX(objectSelect[i].tpX, test_zoom) + ", " + displayCoordinateY(objectSelect[i].tpY, test_zoom) + ", " + objectSelect[i].tpTheta + "]").toString();
      }
    }
  }
  if (objectSelect.length == 0) {
    document.getElementById("robotDisplayTrajectoryPoints").value = "[x, y, theta] tačke trajektorije:"+"\n";
  } else {
    document.getElementById("robotDisplayTrajectoryPoints").value = "[x, y, theta] tačke trajektorije:"+"\n"+"["+textArrayElement+"]";
  }
}

// TURTLEBOT KLASA
function TurtleBot(tbX, tbY, tbTheta, tbZoom){
  this.tbX = convertCoordinateX(tbX, tbZoom);
  this.tbY = convertCoordinateY(tbY, tbZoom);
  this.tbTheta = tbTheta;
  this.tbZoom = tbZoom;
  this.updateRobot = function(x, y, theta, zoom){
    this.tbX = convertCoordinateX(x, zoom);
    this.tbY = convertCoordinateY(y, zoom);
    this.tbTheta = theta;
    this.tbZoom = zoom;
  }
  this.drawRobot = function(){
    //tockovi desni i levi
    context.fillStyle = "#024059";
    context.fillRect(this.tbX-(4*this.tbZoom), this.tbY-(10*this.tbZoom), 8*this.tbZoom, 2*this.tbZoom);
    context.fillStyle = "#024059";
    context.fillRect(this.tbX-(4*this.tbZoom), this.tbY+(8*this.tbZoom), 8*this.tbZoom, 2*this.tbZoom);
    //telo osnova kvadratni deo
    context.fillStyle = "#03658C";
    context.fillRect(this.tbX-(10*this.tbZoom), this.tbY-(6*this.tbZoom), 12*this.tbZoom, 12*this.tbZoom);
    //telo kvadratni bocni delovi
    context.fillStyle = "#03658C";
    context.fillRect(this.tbX-(10*this.tbZoom), this.tbY-(8*this.tbZoom), 12*this.tbZoom, 2*this.tbZoom);
    context.fillStyle = "#03658C";
    context.fillRect(this.tbX-(12*this.tbZoom), this.tbY-(6*this.tbZoom), 2*this.tbZoom, 12*this.tbZoom);
    context.fillStyle = "#03658C";
    context.fillRect(this.tbX-(10*this.tbZoom), this.tbY+(6*this.tbZoom), 12*this.tbZoom, 2*this.tbZoom);
    context.fillStyle = "#03658C";
    context.fillRect(this.tbX+(2*this.tbZoom), this.tbY-(6*this.tbZoom), 2*this.tbZoom, 12*this.tbZoom);
    //telo kvadratni i kruzni deo
    context.fillStyle = "#024059";
    context.fillRect(this.tbX-(8*this.tbZoom), this.tbY-(4*this.tbZoom), 8*this.tbZoom, 8*this.tbZoom);
    context.beginPath();
    context.arc(this.tbX, this.tbY, 4*this.tbZoom, 0, math.PI*2, false);
    context.fillStyle = "#024059";
    context.fill();
    //telo kruzni veci i kruzni manji deo
    context.beginPath();
    context.arc(this.tbX-(4*this.tbZoom), this.tbY, 4*this.tbZoom, 0, math.PI*2, false);
    context.fillStyle = "#0388A6";
    context.fill();
    var colorArray = [
      '#024023',
      '#04BF55',
      '#035928',
      '#038C33',
      '#94F29A',
     ];
    context.beginPath();
    context.arc(this.tbX+(2*this.tbZoom), this.tbY, 1*this.tbZoom, 0, math.PI*2, false);
    context.fillStyle = colorArray[math.floor(math.random()*colorArray.length)];
    context.fill();
  }
  this.rotateRobot = function(){}
}

function LaserScan (angleMin, angleMax, angleIncrement, rangeMin, rangeMax, ranges, lZoom) {
  this.angleMin = angleMin;
  this.angleMax = angleMax;
  this.angleIncrement = angleIncrement;
  this.rangeMin = rangeMin;
  this.rangeMax = rangeMax;
  this.ranges = ranges;
  this.lZoom = lZoom;
  this.updateLaserScan = function (angleMin, angleMax, angleIncrement, rangeMin, rangeMax, ranges, lZoom) {
    this.angleMin = angleMin;
    this.angleMax = angleMax;
    this.angleIncrement = angleIncrement;
    this.rangeMin = rangeMin;
    this.rangeMax = rangeMax;
    this.ranges = ranges;
    this.lZoom = lZoom;
  }
}
var laser = new LaserScan(0, 0, 0, 0, 0, [], test_zoom);

function drawLaserScan (laser, robotPositionX, robotPositionY, robotAngle) {
  if (laser.ranges.length != 0) {
    var step = 0;
    for (var i = 0; i < laser.ranges.length; i++) {
      if (laser.ranges[i] != null) {
        context.fillStyle = "#ff0000";
        context.fillRect(convertCoordinateX(mToCm(laser.ranges[i]*math.cos(laser.angleMin+step)), laser.lZoom),
                         convertCoordinateY(mToCm(laser.ranges[i]*math.sin(laser.angleMin+step)), laser.lZoom),1,1);
        step += laser.angleIncrement;
      } else {
        step += laser.angleIncrement;
      }
    }
  }
}

function drawLaserScanUpdated (laser, robotPositionX, robotPositionY, robotAngle) {
  if (laser.ranges.length != 0) {
    var step = 0;
    for (var i = 0; i < laser.ranges.length; i++) {
      if (laser.ranges[i] != null) {
        context.fillStyle = "#ff0000";
        context.fillRect(convertCoordinateX(mToCm(robotPositionX)-mToCm(0.0345*math.cos(robotAngle))+mToCm(laser.ranges[i]*math.cos(laser.angleMin+robotAngle+step)),laser.lZoom),
                         convertCoordinateY(mToCm(robotPositionY)-mToCm(0.0345*math.sin(robotAngle))+mToCm(laser.ranges[i]*math.sin(laser.angleMin+robotAngle+step)),laser.lZoom),1,1);
        step += laser.angleIncrement;
      } else {
        step += laser.angleIncrement;
      }
    }
  }
}

//TACKA TRAJEKTORIJE KLASA
function TrajectoryPoint(tpX, tpY, tpTheta, tpZoom){
  this.tpX = convertCoordinateX(tpX, tpZoom);
  this.tpY = convertCoordinateY(tpY, tpZoom);
  this.tpTheta = tpTheta;
  this.tpZoom = tpZoom;
  this.updateTrajectoryPoint = function(zoom){
    this.tpX = convertCoordinateX(tpX, zoom);
    this.tpY = convertCoordinateY(tpY, zoom);
    this.tpTheta = tpTheta;
    this.tpZoom = zoom;
    this.drawTrajectoryPoint();
  }
  this.drawTrajectoryPoint = function(){
    context.beginPath();
    context.arc(this.tpX, this.tpY, 8*this.tpZoom, 0, math.PI*2, false);
    context.fillStyle = "#F26D6D";
    context.fill();
    context.beginPath();
    context.arc(this.tpX, this.tpY, 4*this.tpZoom, 0, math.PI*2, false);
    context.fillStyle = "#F2E2CE";
    context.fill();
    context.beginPath();
    context.arc(this.tpX, this.tpY, 2*this.tpZoom, 0, math.PI*2, false);
    context.fillStyle = "#D93636";
    context.fill();
  }
}

function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

var mapArray = [];
var mapArray1 = [];
var worldMap = [];
var gridMap = [];
var robotJointStates = {wheelRightJoint: 0, wheelLeftJoint: 0}
var index = 0;
var canvasDisplay = 0;
var robotSpeed = [0, 0];
var drawStep = 10;
var eRobotDataArray = {x: 0.00, y: 0.00, theta: 0.00, xEKF: 0.00, yEKF: 0.00, thetaEKF: 0.00, v: 0.00, omega: 0.00};
var robotDataArray = [];
var mapEKF = [];
function render() {
  context.fillStyle = "#F2F2F2";
  context.fillRect(0, 0, 500, 500);
  canvasDisplay = 0;

  if (showPG == 1) {
    canvasDisplay = 1;
    drawPointGraph(robotOAMemory, test_zoom);
  }

  if (showGM == 1) {
    canvasDisplay = 1;
    if (gridMap.length != 0) {
      for (var i = 0; i < 125; i++) {
        for (var j = 0; j < 125; j++) {
          drawGridNodeWallMap(gridMap[2][i][j], test_zoom);
        }
      }
    }
    if (pathNodeDrawOL.length != 0) {
      for (var i = 0; i < pathNodeDrawOL.length; i++) {
        drawGridNodeOpenList(pathNodeDrawOL[i], gridMap[2], test_zoom);
      }
    }
    if (pathNodeDrawCL.length != 0) {
      for (var i = 0; i < pathNodeDrawCL.length; i++) {
        drawGridNodeClosedList(pathNodeDrawCL[i], gridMap[2], test_zoom);
      }
    }
    if (pathNodeDrawList.length != 0) {
      for (var i = 0; i < pathNodeDrawList.length; i++) {
        drawGridNodePath(pathNodeDrawList[i], gridMap[2], test_zoom);
      }
    }
    drawGridNodeGrid();
    if (pathNodeDrawTP.length != 0) {
      for (var i = 0; i < pathNodeDrawTP.length; i++) {
        drawGridNodeTargetPoints(pathNodeDrawTP[i], gridMap[2], test_zoom);
      }
    }
  }

  if (laser.ranges.length != 0 && turtlebotArray.length != 0 && showM == 1) {
    canvasDisplay = 1;
    drawGridMap();
    if (worldMap.length != 0) {
      mapGeneratorDrawMap(worldMap, "#000000", test_zoom);
      if (showMLS == 1) {
        drawLaserScan(laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z);
        mapGeneratorDrawMap(mapArray, "#0388A6", test_zoom);
      }
    } else if (mapEKF.length != 0) {
      mapGeneratorDrawMap(mapEKF, "#543864", test_zoom);
      if (showMLS == 1) {
        drawLaserScan(laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z);
        mapGeneratorDrawMap(mapArray, "#0388A6", test_zoom);
      }
    } else if (showMLS == 1) {
      drawLaserScan(laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z);
      mapGeneratorDrawMap(mapArray, "#0388A6", test_zoom);
    }
  }

  if (canvasDisplay == 0) {
    robotGrid();
    if (trajectoryPointsArray.length != 0) {
      for (var i = 0; i < trajectoryPointsArray.length; i++) {
        trajectoryPointsArray[i].drawTrajectoryPoint();
      }
    }
    if (wallsArray.length != 0) {
      for (var i = 0; i < wallsArray.length; i++) {
        wallsArray[i].createWall(test_zoom);
      }
    }
  }

  displayRobotTP();
  displayCanvasWalls();

  sleep(100);
  odometryListener.subscribe(function(message) {
    odometryData.update(message.pose.pose.position.x, message.pose.pose.position.y, message.pose.pose.position.z, message.pose.pose.orientation.x, message.pose.pose.orientation.y, message.pose.pose.orientation.z, message.pose.pose.orientation.w);
    eulerFromQuaternion = convertQuaternionToEuler(odometryData);
    eRobotDataArray.x = odometryData.posePointPositionX;
    eRobotDataArray.y = odometryData.posePointPositionY;
    eRobotDataArray.theta = eulerFromQuaternion.z;
    odometryListener.unsubscribe();
  });

  if (encoderON == 1) {
    if ((euclideanDistance(odometryData, trajectoryPointsArray[index], test_zoom) < cmToM(distanceToleranceInput.value)) && (index < trajectoryPointsArray.length-1)) {
      index += 1;
    }
    robotSpeed = encoder(odometryData, eulerFromQuaternion.z, trajectoryPointsArray[index], test_zoom);
    drawSampleRate({x: odometryData.posePointPositionX, y: odometryData.posePointPositionY, numOfElem: 2}, drawStep);
    eRobotDataArray.v = robotSpeed[0];
    eRobotDataArray.omega = robotSpeed[1];
    updateTwist(twist, robotSpeed[0], 0, 0, 0, 0, robotSpeed[1]);
    cmdVel.publish(twist);
  }

  laserScanListener.subscribe(function(message) {
    laser.updateLaserScan(message.angle_min, message.angle_max, message.angle_increment, message.range_min, message.range_max, message.ranges, test_zoom);
    laserScanListener.unsubscribe();
  });

  if (laser.ranges.length != 0 && turtlebotArray.length != 0 && showLS == 1) {
    drawLaserScanUpdated(laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z);
  }

  if (laser.ranges.length != 0 && turtlebotArray.length != 0 && showMLS == 1 && showM == 0) {
    mapArray1 = mapGeneratorMeasurementNoiseCovariance(mapFilter(mapGeneratorMerge(mapGeneratorSplitWrapper(getDataFromLaserScanUpdated([laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z])))));
    drawLaserScanUpdated(laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z);
    mapGeneratorDrawMap(mapArray1, "#0388A6", test_zoom);
  }

  if (laser.ranges.length != 0 && turtlebotArray.length != 0) {
    mapArray = mapGeneratorMeasurementNoiseCovariance(mapFilter(mapGeneratorMerge(mapGeneratorSplitWrapper(getDataFromLaserScan([laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z])))));
  }
  if (laser.ranges.length != 0 && turtlebotArray.length != 0 && createM == 1) {
    worldMap = mapGeneratorMeasurementNoiseCovariance(mapFilter(mapGeneratorMerge(mapGeneratorSplitWrapper(getDataFromLaserScan([laser, odometryData.posePointPositionX, odometryData.posePointPositionY, eulerFromQuaternion.z])))));
    console.log(worldMap);
    createM = 0;
  }

  if (createGM == 1) {
    gridMap = gridMapGenerator(odometryData, trajectoryPointsArray[index], wallsMatrix, test_zoom);
    console.log(gridMap);
    createGM=0;
  }

  jointStatesListener.subscribe(function(message) {
    robotJointStates.wheelRightJoint = message.position[0];
    robotJointStates.wheelLeftJoint = message.position[1];
    jointStatesListener.unsubscribe();
  });

  if (linebasedEKFON == 1) {
    robotSpeed = linebasedEKF(odometryData, eulerFromQuaternion.z, robotJointStates, mapArray, worldMap, trajectoryPointsArray[index], test_zoom);
    var lbEKFOdometry = new Odometry(robotSpeed[2],robotSpeed[3],0,0,0,0,0);
    if ((euclideanDistance(lbEKFOdometry, trajectoryPointsArray[index], test_zoom) < cmToM(distanceToleranceInput.value)) && (index < trajectoryPointsArray.length-1)) {
      index += 1;
    }
    drawSampleRate({x: odometryData.posePointPositionX, y: odometryData.posePointPositionY, xEKF: robotSpeed[2], yEKF: robotSpeed[3], numOfElem: 4}, drawStep);
    eRobotDataArray.xEKF = robotSpeed[2];
    eRobotDataArray.yEKF = robotSpeed[3];
    eRobotDataArray.thetaEKF = robotSpeed[4];
    eRobotDataArray.v = robotSpeed[0];
    eRobotDataArray.omega = robotSpeed[1];
    updateTwist(twist, robotSpeed[0], 0, 0, 0, 0, robotSpeed[1]);
    cmdVel.publish(twist);
  }

  if (ekfSLAMON == 1) {
    robotSpeed = ekfSLAM(odometryData, eulerFromQuaternion.z, robotJointStates, mapArray, trajectoryPointsArray[index], test_zoom);
    var slamEKFOdometry = new Odometry(robotSpeed[2],robotSpeed[3],0,0,0,0,0);
    if ((euclideanDistance(slamEKFOdometry, trajectoryPointsArray[index], test_zoom) < cmToM(distanceToleranceInput.value)) && (index < trajectoryPointsArray.length-1)) {
      index += 1;
    }
    drawSampleRate({x: odometryData.posePointPositionX, y: odometryData.posePointPositionY, xEKF: robotSpeed[2], yEKF: robotSpeed[3], numOfElem: 4}, drawStep);
    eRobotDataArray.xEKF = robotSpeed[2];
    eRobotDataArray.yEKF = robotSpeed[3];
    eRobotDataArray.thetaEKF = robotSpeed[4];
    mapEKF = robotSpeed[5];
    eRobotDataArray.v = robotSpeed[0];
    eRobotDataArray.omega = robotSpeed[1];
    updateTwist(twist, robotSpeed[0], 0, 0, 0, 0, robotSpeed[1]);
    cmdVel.publish(twist);
  }

  if (aStarPSAON == 1 && gridMap.length != 0) {
    robotSpeed = aStarPSAController(odometryData, eulerFromQuaternion.z, gridMap, trajectoryPointsArray[index], test_zoom);
    drawSampleRate({x: odometryData.posePointPositionX, y: odometryData.posePointPositionY, numOfElem: 2}, drawStep);
    eRobotDataArray.v = robotSpeed[0];
    eRobotDataArray.omega = robotSpeed[1];
    updateTwist(twist, robotSpeed[0], 0, 0, 0, 0, robotSpeed[1]);
    cmdVel.publish(twist);
  }

  if (stopR == 1) {
    encoderON = 0;
    linebasedEKFON = 0;
    ekfSLAMON = 0;
    aStarPSAON = 0;
    stopR = 0;
    robotSpeed = [0, 0];
    eRobotDataArray.v = robotSpeed[0];
    eRobotDataArray.omega = robotSpeed[1];
    updateTwist(twist, robotSpeed[0], 0, 0, 0, 0, robotSpeed[1]);
    cmdVel.publish(twist);
  }

  robotDataArray.push(eRobotDataArray);
  displayRobotInfo(robotDataArray);

  context.save();
  if (turtlebotArray.length != 0) {
    turtlebotArray[0].updateRobot(mToCm(odometryData.posePointPositionX), mToCm(odometryData.posePointPositionY), THREE.Math.radToDeg(eulerFromQuaternion.z), test_zoom);
    if (canvasDisplay == 0) {
      context.translate(turtlebotArray[0].tbX, turtlebotArray[0].tbY); // Translacija koordinatnog centra canvas elementa u centar oblika.
      context.rotate(-eulerFromQuaternion.z);
      context.translate(-turtlebotArray[0].tbX, -turtlebotArray[0].tbY); // Vraćanje translacijom nazad u koordinatnog centra u koordinatni početak (0, 0) canvas elementa.
      turtlebotArray[0].drawRobot();
    }
  }
  context.restore();
  window.requestAnimationFrame(render);
}

window.requestAnimationFrame(render);
