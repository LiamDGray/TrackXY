# CMake generated Testfile for 
# Source directory: /home/liam/src/TrackXY
# Build directory: /home/liam/src/TrackXY/build
# 
# This file includes the relevant testing commands required for 
# testing this directory and lists subdirectories to be tested as well.
add_test(unit_tests "/home/liam/src/TrackXY/build/unit_tests")
set_tests_properties(unit_tests PROPERTIES  _BACKTRACE_TRIPLES "/home/liam/src/TrackXY/CMakeLists.txt;30;add_test;/home/liam/src/TrackXY/CMakeLists.txt;0;")
subdirs("_deps/catch2-build")
