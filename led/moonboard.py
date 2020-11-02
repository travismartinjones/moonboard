# -*- coding: utf-8 -*-
from bibliopixel.colors import COLORS
from bibliopixel import Strip
from bibliopixel.drivers.PiWS281X import PiWS281X
from bibliopixel.drivers.dummy_driver import DriverDummy
from bibliopixel.drivers.SPI.WS2801 import  WS2801
from bibliopixel.drivers.SimPixel import SimPixel
from bibliopixel.drivers.spi_interfaces import SPI_INTERFACES
import string

LED_LAYOUT = {
    'nest':[
    # Top panel
    [137, 138, 149, 150, 161, 162, 173, 174, 185, 186, 197],
    [136, 139, 148, 151, 160, 163, 172, 175, 184, 187, 196],
    [135, 140, 147, 152, 159, 164, 171, 176, 183, 188, 195],
    [134, 141, 146, 153, 158, 165, 170, 177, 182, 189, 194],
    [133, 142, 145, 154, 157, 166, 169, 178, 181, 190, 193],
    [132, 143, 144, 155, 156, 167, 168, 179, 180, 191, 192],
    # Middle panel
    [131, 120, 119, 108, 107, 96, 95, 84, 83, 72, 71],
    [130, 121, 118, 109, 106, 97, 94, 85, 82, 73, 70],
    [129, 122, 117, 110, 105, 98, 93, 86, 81, 74, 69],
    [128, 123, 116, 111, 104, 99, 92, 87, 80, 75, 68],
    [127, 124, 115, 112, 103, 100, 91, 88, 79, 76, 67],
    [126, 125, 114, 113, 102, 101, 90, 89, 78, 77, 66],
    # Bottom panel
    [5, 6, 17, 18, 29, 30, 41, 42, 53, 54, 65],
    [4, 7, 16, 19, 28, 31, 40, 43, 52, 55, 64],
    [3, 8, 15, 20, 27, 32, 39, 44, 51, 56, 63],
    [2, 9, 14, 21, 26, 33, 38, 45, 50, 57, 62],
    [1, 10, 13, 22, 25, 34, 37, 46, 49, 58, 61],
    [0, 11, 12, 23, 24, 35, 36, 47, 48, 59, 60]],

'custom': [[ 17, 52, 87, 122, 157, 192, 227, 262, 297, 332, 367],
       [ 18,  53,  88, 123, 158, 193, 228, 263, 298, 333, 368],
       [ 19,  54,  89, 124, 159, 194, 229, 264, 299, 334, 369],
       [ 20,  55,  90, 125, 160, 195, 230, 265, 300, 335, 370],
       [ 21,  56,  91, 126, 161, 196, 231, 266, 301, 336, 371],
       [ 22,  57,  92, 127, 162, 197, 232, 267, 302, 337, 372],
       [ 23,  58,  93, 128, 163, 198, 233, 268, 303, 338, 373],
       [ 24,  59,  94, 129, 164, 199, 234, 269, 304, 339, 374],
       [ 25,  60,  95, 130, 165, 200, 235, 270, 305, 340, 375],
       [ 26,  61,  96, 131, 166, 201, 236, 271, 306, 341, 376],
       [ 27,  62,  97, 132, 167, 202, 237, 272, 307, 342, 377],
       [ 28,  63,  98, 133, 168, 203, 238, 273, 308, 343, 378],
       [ 29,  64,  99, 134, 169, 204, 239, 274, 309, 344, 379],
       [ 30,  65, 100, 135, 170, 205, 240, 275, 310, 345, 380],
       [ 31,  66, 101, 136, 171, 206, 241, 276, 311, 346, 371],
       [ 32,  67, 102, 137, 172, 207, 242, 278, 312, 347, 382],
       [ 33,  68, 103, 138, 173, 208, 243, 279, 313, 348, 383],
       [ 34,  69, 104, 139, 174, 209, 244, 280, 314, 349, 384]],
       
'evo': [[ 17,  18,  53,  54,  89,  90, 125, 126, 161, 162, 197],
       [ 16,  19,  52,  55,  88,  91, 124, 127, 160, 163, 196],
       [ 15,  20,  51,  56,  87,  92, 123, 128, 159, 164, 195],
       [ 14,  21,  50,  57,  86,  93, 122, 129, 158, 165, 194],
       [ 13,  22,  49,  58,  85,  94, 121, 130, 157, 166, 193],
       [ 12,  23,  48,  59,  84,  95, 120, 131, 156, 167, 192],
       [ 11,  24,  47,  60,  83,  96, 119, 132, 155, 168, 191],
       [ 10,  25,  46,  61,  82,  97, 118, 133, 154, 169, 190],
       [  9,  26,  45,  62,  81,  98, 117, 134, 153, 170, 189],
       [  8,  27,  44,  63,  80,  99, 116, 135, 152, 171, 188],
       [  7,  28,  43,  64,  79, 100, 115, 136, 151, 172, 187],
       [  6,  29,  42,  65,  78, 101, 114, 137, 150, 173, 186],
       [  5,  30,  41,  66,  77, 102, 113, 138, 149, 174, 185],
       [  4,  31,  40,  67,  76, 103, 112, 139, 148, 175, 184],
       [  3,  32,  39,  68,  75, 104, 111, 140, 147, 176, 183],
       [  2,  33,  38,  69,  74, 105, 110, 141, 146, 177, 182],
       [  1,  34,  37,  70,  73, 106, 109, 142, 145, 178, 181],
       [  0,  35,  36,  71,  72, 107, 108, 143, 144, 179, 180]]
}

class MoonBoard:
    DEFAULT_PROBLEM_COLORS = {'START':(0, 250, 100),'TOP':(180, 0, 220),'MOVES':(0, 190, 250),'FEET':(250, 210, 50)}
    DEFAULT_COLOR = COLORS.blue
    X_GRID_NAMES = string.ascii_uppercase[0:11]
    NUM_PIXELS = 402
    DEFAULT_BRIGHTNESS = 150

    def __init__(self, driver_type, led_layout=None, brightness=DEFAULT_BRIGHTNESS):
        try:
            if driver_type == "PiWS281x":
                driver = PiWS281X(self.NUM_PIXELS)
            elif driver_type == "WS2801":
                driver = WS2801(self.NUM_PIXELS, dev='/dev/spidev0.1',spi_interface= SPI_INTERFACES.PERIPHERY,spi_speed=1)
            elif driver_type == "SimPixel":
                driver = SimPixel(self.NUM_PIXELS)
                driver.open_browser()
            else:
                raise ValueError("driver_type {driver_type} unknow.".format(driver_type) )
        except (ImportError, ValueError) as e:
            print("Not able to initialize the driver. Error{}".format(e))
            print("Use bibliopixel.drivers.dummy_driver")
            driver = DriverDummy(self.NUM_PIXELS)

        self.moonboard_layout = led_layout
        self.layout = Strip(driver,
                            threadedUpdate=True,
                            brightness=brightness
                            )
        self.layout.cleanup_drivers()
        self.layout.start()
        self.animation = None

    def clear(self):
        self.stop_animation()
        self.layout.all_off()
        self.layout.push_to_driver()

    def set_hold(self, hold, color=DEFAULT_COLOR):
        try:
            x_grid_name, y_grid_name = hold[0], int(hold[1:])
            x = self.X_GRID_NAMES.index(x_grid_name)
            y = 18 - y_grid_name
            self.layout.set(self.moonboard_layout[y][x], color)
        except ValueError:
            self.layout.set(int(hold),color)

    def show_hold(self, hold, color=DEFAULT_COLOR):
        self.set_hold(hold, color)
        self.layout.push_to_driver()

    def show_problem(self, holds, hold_colors={}):
        self.clear()
        for k in ['START', 'MOVES', 'TOP', 'FEET']:
            if k in holds:
                for hold in holds[k]:
                    self.set_hold(
                        hold, 
                        hold_colors.get(k, self.DEFAULT_PROBLEM_COLORS[k]),
                    )
        self.layout.push_to_driver()

    def run_animation(self, animation, run_options={}, **kwds):
        self.stop_animation()
        self.animation = animation(self.layout, **kwds)
        self.animation.run(**run_options)

    def stop_animation(self):
        if self.animation is not None:
            self.animation.stop()


class TestAnimation:
    COLOR=[COLORS.Green, COLORS.Blue]
    def __init__(self, layout, ):
        self.layout = layout

    def step(self, amt=1):
        pass

if __name__=="__main__":
    import argparse
    import time
    import subprocess

    parser = argparse.ArgumentParser(description='Test led system')

    parser.add_argument('driver_type', type=str,
                        help='driver type, depends on leds and device controlling the led.',choices=['PiWS281x', 'WS2801', 'SimPixel'])
    parser.add_argument('--duration',  type=int, default=10,
                        help='Delay of progress.')
    parser.add_argument('--special_nest_layout',  action='store_true')
    args = parser.parse_args()
    
    print("Test MOONBOARD LEDS\n===========")
    led_layout = LED_LAYOUT['nest'] if args.special_nest_layout else None
    MOONBOARD = MoonBoard(args.driver_type,led_layout )
    print("Run animation,")
    #animation=
    #MoonBoard.run_animation()
    #MOONBOARD.layout.fillScreen(COLORS.red)
    #print(f"wait {args.duration} seconds,")
    time.sleep(args.duration)
    print("clear and exit.")
    MOONBOARD.clear()	